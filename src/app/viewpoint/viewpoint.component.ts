import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  OnDestroy,
  OnInit
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  fadeInOnEnterAnimation,
  fadeOutOnLeaveAnimation
} from 'angular-animations';
import {
  CameraService,
  CesiumEvent,
  CoordinateConverter,
  EventResult,
  MapEventsManagerService,
  MapsManagerService
} from 'angular-cesium';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { assign, interpret, Machine } from 'xstate';
import { StateAccessor } from '../shared/state-accessor';

interface CameraParameter {
  position: any;
  orientation: {
    heading: number;
    pitch: number;
    roll: number;
  };
}

interface ObserverSummit {
  /**
   * The summit name
   */
  name: string;

  /**
   * The summit coordinates in degrees
   */
  coordinates: {
    latitude: number;
    longitude: number;
  };

  /**
   * The summit elevation in meter
   */
  elevation: number;

  /**
   * The summit distance from observer positin in meter
   */
  distance: number;

  /**
   * Determines whether view is blocked by terrain
   */
  isViewBlocked: boolean;
}

//#region GeoJson
interface GeoJsonFeature {
  type: 'Feature';
  properties: any;
  geometry: {
    type: 'Point';
    coordinates: number[];
  };
}

interface GeoJson {
  name: string;
  features: GeoJsonFeature[];
}
//#endregion

//#region XState
enum ViewpointStateName {
  Exploring = 'exploring',
  CheckingViewpoint = 'checkingViewpoint',
  Viewing = 'viewing'
}

enum ViewpointEventName {
  View = 'VIEW',
  Explore = 'EXPLORE'
}

enum ViewpointActionName {
  SetViewpoint = 'setViewpoint',
  RestoreCamera = 'restoreCamera',
  ShowPositionIndicator = 'showPositionIndicator',
  HidePositionIndicator = 'hidePositionIndicator'
}

interface ViewpointStateSchema {
  states: {
    [ViewpointStateName.Exploring]: {};
    [ViewpointStateName.CheckingViewpoint]: {};
    [ViewpointStateName.Viewing]: {};
  };
}

class ViewpointEventView {
  type = ViewpointEventName.View;

  constructor(public clickEvent: EventResult, public camera: CameraParameter) {}
}

class ViewpointEventExplore {
  type = ViewpointEventName.Explore;
}

type ViewpointEvent = ViewpointEventView | ViewpointEventExplore;

interface ViewpointContext {
  /**
   * The last camera parameter when exploring to restore view
   */
  cameraParameter?: CameraParameter;

  /**
   * Last map click event to set viewpoint
   */
  clickEvent?: EventResult;

  /**
   * Observer meta data
   */
  observer?: ViewpointContextObserver;
}

interface ViewpointContextObserver {
  closestSummit: ObserverSummit;
  position: any;
  bearing: number;
}
//#endregion

@Component({
  selector: 'app-viewpoint',
  template: `
    <mat-spinner
      *ngIf="
        (state.current$ | async)?.matches(ViewpointStateName.CheckingViewpoint)
      "
      [@fadeInOnEnter]
      [@fadeOutOnLeave]
      [diameter]="48"
      color="accent"
    ></mat-spinner>
  `,
  styles: [
    ':host { display: block; position: relative; }',
    'mat-spinner { left: 16px; position: absolute; top: 16px; z-index: 1; }'
  ],
  animations: [fadeInOnEnterAnimation(), fadeOutOnLeaveAnimation()],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewpointComponent implements OnInit, OnDestroy {
  /**
   * Observer height on the ground (eyes)
   */
  private readonly observerHeight = 1.6;

  /**
   * Elevate target height vertically (i.e. to compensate close interstion-with-terrain)
   */
  private readonly targetVerticalOffset = 5;

  private readonly stateMachine = Machine<
    ViewpointContext,
    ViewpointStateSchema,
    ViewpointEvent
  >(
    {
      id: 'viewpoint',
      initial: ViewpointStateName.Exploring,
      context: {},
      states: {
        exploring: {
          entry: [
            ViewpointActionName.RestoreCamera,
            ViewpointActionName.ShowPositionIndicator
          ],
          exit: ViewpointActionName.HidePositionIndicator,
          on: {
            VIEW: {
              target: ViewpointStateName.CheckingViewpoint,
              actions: assign({
                cameraParameter: (ctx, event: ViewpointEventView) =>
                  event.camera,
                clickEvent: (ctx, event: ViewpointEventView) => event.clickEvent
              })
            }
          }
        },
        checkingViewpoint: {
          invoke: {
            id: 'checkViewpoint',
            src: (ctx, event) => this.checkViewpoint(ctx),
            onDone: {
              target: ViewpointStateName.Viewing,
              actions: assign({
                observer: (ctx, event) => event.data
              })
            },
            onError: {
              target: ViewpointStateName.Exploring
            }
          }
        },
        viewing: {
          entry: ViewpointActionName.SetViewpoint,
          // exit: ViewpointActionName.RestoreCamera,
          on: {
            EXPLORE: ViewpointStateName.Exploring
            // VIEW: {
            //   target: ViewpointStateName.CheckingViewpoint,
            //   actions: assign({
            //     clickEvent: (ctx, event: ViewpointEventView) => event.clickEvent
            //   })
            // }
          }
        }
      }
    },
    {
      actions: {
        [ViewpointActionName.SetViewpoint]: this.onSetViewpoint(),
        [ViewpointActionName.RestoreCamera]: this.onRestoreCamera(),
        [ViewpointActionName.ShowPositionIndicator]: this.onShowPositionIndicator(),
        [ViewpointActionName.HidePositionIndicator]: this.onHidePositionIndicator()
      }
    }
  );

  private summits: GeoJson;

  //#region Cesium
  private viewer: any;
  private currentPosition?: any;
  private positionIndicator: any;
  //#endregion

  private unsubscribed$: Subject<void> = new Subject<void>();

  public readonly ViewpointStateName = ViewpointStateName;

  public stateService = interpret(this.stateMachine)
    // .onTransition(state => console.log('   TRANSITION: ' + state.value))
    .start();

  public state = new StateAccessor(this.stateService);

  public Cesium = Cesium;

  constructor(
    private snackbar: MatSnackBar,
    private eventManager: MapEventsManagerService,
    private coordinateConverter: CoordinateConverter,
    private cameraService: CameraService,
    private mapsManagerService: MapsManagerService,
    private http: HttpClient,
    private ngZone: NgZone
  ) {}

  //#region Angular lifecycle hooks
  async ngOnInit() {
    this.summits = await this.http
      .get<GeoJson>('assets/alps_summits.geojson')
      .toPromise();

    // console.log('summits', this.summits);
    const mapComponent = this.mapsManagerService.getMap();
    this.viewer = mapComponent ? mapComponent.getCesiumViewer() : undefined;

    if (!this.viewer) {
      throw new TypeError('The Cesium `viewer` object is not available');
    }

    this.eventManager
      .register({ event: CesiumEvent.LEFT_CLICK })
      .pipe(takeUntil(this.unsubscribed$))
      .subscribe(event => this.onMapClick(event));

    this.eventManager
      .register({ event: CesiumEvent.MOUSE_MOVE })
      .pipe(takeUntil(this.unsubscribed$))
      .subscribe(event => this.onMapMouseMove(event));

    this.createPositionIndicator();
  }

  ngOnDestroy() {
    this.stateService.stop();
    this.unsubscribed$.next();
    this.unsubscribed$.complete();
    this.destroyPositionIndicator();
  }
  //#endregion

  private createPositionIndicator() {
    const dynamicPosition = new Cesium.CallbackProperty(
      () => this.currentPosition,
      false
    );

    // Since `Ellipse` entity borders are not clamped to the ground we can
    // fake the effect with a very very short corridor with rounded corners :)
    let almostSamePosition: any;
    const dynamicPositions = new Cesium.CallbackProperty(() => {
      if (this.currentPosition) {
        almostSamePosition = Cesium.Cartographic.fromCartesian(
          this.currentPosition
        );
        almostSamePosition.latitude += 0.000001;
        return [
          this.currentPosition,
          Cesium.Cartographic.toCartesian(
            almostSamePosition,
            Cesium.Ellipsoid.WGS84,
            almostSamePosition
          )
        ];
      }
    }, false);

    this.positionIndicator = this.viewer.entities.add({
      id: `position-indicator`,
      name: 'Position Indicator',
      position: dynamicPosition,
      point: {
        color: Cesium.Color.WHITE,
        pixelSize: 4,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1
      },
      corridor: {
        positions: dynamicPositions,
        cornerType: Cesium.CornerType.ROUNDED,
        width: 500.0,
        material: Cesium.Color.WHITE.withAlpha(0.3)
      },
      label: {
        text: 'Click to view from ground',
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: { x: 0, y: -8 },
        font: '16px sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        fillColor: Cesium.Color.WHITE.withAlpha(0.8),
        outlineColor: Cesium.Color.BLACK.withAlpha(0.8),
        outlineWidth: 4,
        disableDepthTestDistance: Number.POSITIVE_INFINITY // Avoid that label is clipped
      }
    });
  }

  private destroyPositionIndicator() {
    if (this.positionIndicator) {
      this.viewer.entities.remove(this.positionIndicator);
    }
  }

  private async checkViewpoint(
    ctx: ViewpointContext
  ): Promise<ViewpointContextObserver> {
    type SummitGeoJsonFeature = GeoJsonFeature & {
      distanceSquared: number;
      cartesian: any;
    };

    if (!ctx.clickEvent) {
      throw new TypeError('Context `clickEvent` is missing');
    }

    const observerCartographicPosition = this.coordinateConverter.screenToCartographic(
      ctx.clickEvent.movement.endPosition
    );

    const updatedObserverCartographicPosition = (
      await Cesium.sampleTerrainMostDetailed(this.viewer.terrainProvider, [
        observerCartographicPosition
      ])
    )[0];

    // Add viewshed observer height
    updatedObserverCartographicPosition.height += this.observerHeight; // + 30;

    const observerCartesianPosition = Cesium.Cartographic.toCartesian(
      updatedObserverCartographicPosition
    );

    const summitsByClosestDistance: SummitGeoJsonFeature[] = this.summits.features
      .map(feature => {
        const target = Cesium.Cartesian3.fromDegrees(
          feature.geometry.coordinates[0],
          feature.geometry.coordinates[1],
          feature.properties.ALT + this.targetVerticalOffset
        );
        return {
          ...feature,
          distanceSquared: Cesium.Cartesian3.distanceSquared(
            target,
            observerCartesianPosition
          ),
          cartesian: target
        };
      })
      .sort(
        (feature1, feature2) =>
          feature1.distanceSquared - feature2.distanceSquared
      );

    // Based on https://groups.google.com/forum/#!topic/cesium-dev/j5Qb_HZ0bIQ
    let direction = new Cesium.Cartesian3();
    let closestSummitGeoJson: SummitGeoJsonFeature | undefined;
    let i = 0;
    while (i < summitsByClosestDistance.length - 1 && !closestSummitGeoJson) {
      direction = Cesium.Cartesian3.subtract(
        summitsByClosestDistance[i].cartesian,
        observerCartesianPosition,
        direction
      );
      Cesium.Cartesian3.normalize(direction, direction);
      if (
        !this.viewer.scene.globe.pick(
          new Cesium.Ray(observerCartesianPosition, direction),
          this.viewer.scene
        )
      ) {
        closestSummitGeoJson = summitsByClosestDistance[i];
      }

      i++;
    }

    const isViewBlocked = !closestSummitGeoJson;
    if (!closestSummitGeoJson) {
      console.warn('No summit visible, falling back to closest');
      closestSummitGeoJson = summitsByClosestDistance[0];
    }

    // DEBUG
    // const directionRay = Cesium.Cartesian3.multiplyByScalar(
    //   direction,
    //   100000,
    //   new Cesium.Cartesian3()
    // );
    // Cesium.Cartesian3.add(
    //   observerCartesianPosition,
    //   directionRay,
    //   directionRay
    // );

    // viewer.entities.add({
    //   polyline: {
    //     positions: [observerCartesianPosition, directionRay],
    //     width: 5,
    //     arcType: Cesium.ArcType.NONE
    //   },
    //   position: closestSummitGeoJson.cartesian,
    //   point: {
    //     color: Cesium.Color.GREENYELLOW,
    //     pixelSize: 20,
    //     outlineColor: Cesium.Color.WHITE,
    //     outlineWidth: 2
    //   },
    //   label: {
    //     text: 'Target',
    //     pixelOffset: { x: 0, y: 20 },
    //     verticalOrigin: Cesium.VerticalOrigin.TOP
    //   }
    // });

    const bearing = this.coordinateConverter.bearingTo(
      updatedObserverCartographicPosition,
      Cesium.Cartographic.fromDegrees(
        closestSummitGeoJson.geometry.coordinates[0],
        closestSummitGeoJson.geometry.coordinates[1]
      )
    );

    // console.log('summitsByClosestDistance', summitsByClosestDistance);
    // console.log('closestVisibleSummit', closestSummitGeoJson);

    const closestSummit: ObserverSummit = {
      name: closestSummitGeoJson.properties.field_2,
      elevation: closestSummitGeoJson.properties.ALT,
      distance: Math.sqrt(closestSummitGeoJson.distanceSquared),
      coordinates: {
        longitude: closestSummitGeoJson.geometry.coordinates[0],
        latitude: closestSummitGeoJson.geometry.coordinates[1]
      },
      isViewBlocked
    };

    return { closestSummit, position: observerCartesianPosition, bearing };
  }

  private async setViewpoint(
    summit: ObserverSummit,
    observerPosition: any,
    observerBearing: number
  ) {
    this.cameraService.cameraFlyTo({
      destination: observerPosition,
      orientation: {
        heading: Cesium.Math.toRadians(observerBearing),
        pitch: 0,
        roll: 0
      }
    });

    // Must run inside zone since we're in the `angular-cesium` map context
    this.ngZone.run(async () => {
      const snackBarRef = this.snackbar.open(
        `Closest summit is ${
          summit
            ? `${summit.name} (Elevation: ${Math.round(
                summit.elevation
              )}\u202Fm, Distance: ${(summit.distance / 1000).toFixed(
                2
              )}\u202Fkm)${
                summit.isViewBlocked ? ' - visibility blocked by terrain' : ''
              }`
            : 'not available'
        }`,
        'Exit'
      );
      await snackBarRef.onAction().toPromise();
      this.stateService.send(new ViewpointEventExplore());
    });
  }

  private restoreCamera(camera: CameraParameter) {
    this.cameraService.cameraFlyTo({
      destination: camera.position,
      orientation: camera.orientation
    });
  }

  //#region XState Events
  private onRestoreCamera() {
    return (ctx: ViewpointContext, event) => {
      if (!ctx.cameraParameter) {
        // throw new TypeError('Context `cameraParameter` is missing');
        return;
      }

      this.restoreCamera(ctx.cameraParameter);
    };
  }

  private onSetViewpoint() {
    return (ctx: ViewpointContext, event) => {
      if (!ctx.observer) {
        throw new TypeError('Context `observer` is missing');
      }

      this.setViewpoint(
        ctx.observer.closestSummit,
        ctx.observer.position,
        ctx.observer.bearing
      );
    };
  }

  private onShowPositionIndicator() {
    return (ctx: ViewpointContext, event) => {
      if (this.positionIndicator) {
        this.positionIndicator.show = true;
      }
    };
  }

  private onHidePositionIndicator() {
    return (ctx: ViewpointContext, event) => {
      if (this.positionIndicator) {
        this.positionIndicator.show = false;
      }
    };
  }
  //#endregion

  //#region UI Events
  onMapClick(event: EventResult) {
    const camera = this.cameraService.getCamera();
    this.stateService.send(
      new ViewpointEventView(event, {
        position: camera.position.clone(),
        orientation: {
          heading: camera.heading,
          pitch: camera.pitch,
          roll: camera.roll
        }
      })
    );
  }

  onMapMouseMove(event: EventResult) {
    //   this.currentPosition = this.coordinateConverter.screenToCartesian3(
    //     event.movement.endPosition
    //   );
    this.currentPosition = this.viewer.scene.pickPosition(
      event.movement.endPosition
    );
  }

  //#endregion
}
