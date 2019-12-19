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
  lastCamera?: CameraParameter;
  lastClickEvent?: EventResult;
}
//#endregion

@Component({
  selector: 'app-viewpoint',
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewpointComponent implements OnInit, OnDestroy {
  private readonly observerHeight = 1.6;

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
          on: {
            VIEW: {
              target: ViewpointStateName.CheckingViewpoint,
              actions: assign({
                lastCamera: (ctx, event: ViewpointEventView) => event.camera,
                lastClickEvent: (ctx, event: ViewpointEventView) =>
                  event.clickEvent
              })
            }
          }
        },
        checkingViewpoint: {
          invoke: {
            id: 'checkViewpoint',
            src: (ctx, event) => this.checkViewpoint(ctx, event),
            onDone: {
              target: ViewpointStateName.Viewing
            },
            onError: {
              target: ViewpointStateName.Exploring
            }
          }
        },
        viewing: {
          entry: 'setViewpoint',
          exit: 'restoreCamera',
          on: {
            EXPLORE: ViewpointStateName.Exploring
          }
        }
      }
    },
    {
      actions: {
        setViewpoint: (ctx, event) => {
          if (!ctx.lastClickEvent) {
            return;
          }
          console.log('should set viewpoint', ctx, event);
          this.setViewpoint(ctx.lastClickEvent);
        },
        restoreCamera: (ctx, event) => {
          if (!ctx.lastCamera) {
            return;
          }
          console.log('should restore camera');
          this.restoreCamera(ctx.lastCamera);
        }
      }
    }
  );
  private summits: GeoJson;
  private unsubscribed$: Subject<void> = new Subject<void>();

  public stateService = interpret(this.stateMachine)
    .onTransition(state => console.log('   TRANSITION: ' + state.value))
    .start();

  public state = new StateAccessor(this.stateService);

  constructor(
    private snackbar: MatSnackBar,
    private eventManager: MapEventsManagerService,
    private coordinateConverter: CoordinateConverter,
    private cameraService: CameraService,
    private mapsManagerService: MapsManagerService,
    private http: HttpClient,
    private ngZone: NgZone
  ) {}

  async ngOnInit() {
    this.summits = await this.http
      .get<GeoJson>('assets/alps_summits.geojson')
      .toPromise();

    console.log('summits', this.summits);

    this.eventManager
      .register({ event: CesiumEvent.LEFT_CLICK })
      .pipe(takeUntil(this.unsubscribed$))
      .subscribe(event => this.onMapClick(event));
  }

  ngOnDestroy() {
    this.stateService.stop();
    this.unsubscribed$.next();
    this.unsubscribed$.complete();
  }

  //#region XState Services
  private checkViewpoint(ctx, event) {
    console.log('should check viewpoint location', ctx, event);
    return new Promise(resolve => {
      resolve(event);
    });
  }

  async setViewpoint(event: EventResult) {
    const mapComponent = this.mapsManagerService.getMap();
    const viewer = mapComponent ? mapComponent.getCesiumViewer() : undefined;

    if (!viewer) {
      throw new Error('The Cesium `viewer` object is not available');
    }

    const cartographicPosition = this.coordinateConverter.screenToCartographic(
      event.movement.endPosition
    );

    const updatedCartographicPosition = (
      await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [
        cartographicPosition
      ])
    )[0];

    // Add viewshed observer height
    updatedCartographicPosition.height += this.observerHeight;

    console.log('updatedCartographicPosition', updatedCartographicPosition);

    const observer = Cesium.Cartographic.toCartesian(
      updatedCartographicPosition
    );

    let target = new Cesium.Cartesian3();
    const summitsByClosestDistance: (GeoJsonFeature & {
      distance: number;
      cartesian: any;
    })[] = this.summits.features
      .map(feature => {
        target = Cesium.Cartesian3.fromDegrees(
          feature.geometry.coordinates[0],
          feature.geometry.coordinates[1],
          feature.properties.ALT,
          Cesium.Ellipsoid.WGS84,
          target
        );
        return {
          ...feature,
          distance: Cesium.Cartesian3.distanceSquared(target, observer),
          cartesian: target
        };
      })
      .sort((feature1, feature2) => feature1.distance - feature2.distance);

    const direction = new Cesium.Cartesian3();
    let closestVisibleSummit: GeoJsonFeature | undefined;
    let i = 0;
    while (i < summitsByClosestDistance.length - 1 && !closestVisibleSummit) {
      if (
        !viewer.scene.globe.pick(
          new Cesium.Ray(
            observer,
            Cesium.Cartesian3.subtract(
              summitsByClosestDistance[i].cartesian,
              observer,
              direction
            )
          ),
          viewer.scene
        )
      ) {
        closestVisibleSummit = summitsByClosestDistance[i];
      }

      i++;
    }

    if (!closestVisibleSummit) {
      console.warn('No summit visible, falling back to closest');
      closestVisibleSummit = summitsByClosestDistance[0];
    }

    const bearing = this.coordinateConverter.bearingTo(
      updatedCartographicPosition,
      Cesium.Cartographic.fromDegrees(
        closestVisibleSummit.geometry.coordinates[0],
        closestVisibleSummit.geometry.coordinates[1]
      )
    );

    console.log('summitsByClosestDistance', summitsByClosestDistance);
    console.log('closestVisibleSummit', closestVisibleSummit);

    this.cameraService.cameraFlyTo({
      destination: observer,
      orientation: {
        heading: Cesium.Math.toRadians(bearing),
        pitch: 0,
        roll: 0
      }
    });

    // Must run inside zone since we're in the `angular-cesium` map context
    this.ngZone.run(async () => {
      const snackBarRef = this.snackbar.open(
        `Closest summit is ${
          closestVisibleSummit
            ? closestVisibleSummit.properties.field_2
            : 'not available'
        }`,
        'Exit'
      );
      await snackBarRef.onAction().toPromise();
      this.stateService.send(new ViewpointEventExplore());
    });
  }

  restoreCamera(camera: CameraParameter) {
    this.cameraService.cameraFlyTo({
      destination: camera.position,
      orientation: camera.orientation
    });
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

  onExitClick() {
    this.stateService.send(new ViewpointEventExplore());
  }
  //#endregion
}
