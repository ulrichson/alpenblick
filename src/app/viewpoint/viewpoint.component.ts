import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import {
  CameraService,
  CesiumEvent,
  CoordinateConverter,
  MapEventsManagerService,
  MapsManagerService
} from 'angular-cesium';
import { DefaultContext, interpret, Machine } from 'xstate';

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

//#region XState
interface ViewpointStateSchema {
  states: {
    exploring: {};
    checkingViewpoint: {};
    viewing: {};
  };
}

class ViewpointEventView {
  type = 'VIEW';
}

class ViewpointEventExplore {
  type = 'EXPLORE';
}

type ViewpointEvent = ViewpointEventView | ViewpointEventExplore;

type ViewpointContext = DefaultContext;
//#endregion

@Component({
  selector: 'app-viewpoint',
  templateUrl: './viewpoint.component.html',
  styleUrls: ['./viewpoint.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewpointComponent implements OnInit, OnDestroy {
  private readonly stateMachine = Machine<
    ViewpointContext,
    ViewpointStateSchema,
    ViewpointEvent
  >(
    {
      id: 'viewpoint',
      initial: 'exploring',
      states: {
        exploring: {
          on: {
            VIEW: 'checkingViewpoint'
          }
        },
        checkingViewpoint: {
          invoke: {
            id: 'checkViewpoint',
            src: (ctx, event) => this.onCheckViewpoint(ctx, event),
            onDone: {
              target: 'viewing'
              // actions: ['log']
            },
            onError: {
              target: 'exploring'
              // actions: ['log']
            }
          }
        },
        viewing: {
          on: {
            EXPLORE: 'exploring'
          }
        }
      }
    }
    // {
    //   actions: {
    //     log: (ctx, event) => {
    //       console.log('    ACTION', ctx, event);
    //     }
    //   }
    // }
  );
  private summits: GeoJson;
  public stateService = interpret(this.stateMachine)
    .onTransition(state => console.log('   TRANSITION: ' + state.value))
    .start();

  // state$ = from(this.stateMachineService);

  constructor(
    // private snackbar: MatSnackBar,
    private eventManager: MapEventsManagerService,
    private coordinateConverter: CoordinateConverter,
    private cameraService: CameraService,
    private mapsManagerService: MapsManagerService,
    private http: HttpClient
  ) {}

  private onCheckViewpoint(ctx, event) {
    console.log('should check viewpoint location');
    return Promise.resolve();
  }

  async ngOnInit() {
    this.summits = await this.http
      .get<GeoJson>('assets/alps_summits.geojson')
      .toPromise();

    console.log('summits', this.summits);

    const mapComponent = this.mapsManagerService.getMap();
    const viewer = mapComponent ? mapComponent.getCesiumViewer() : undefined;
    this.eventManager
      .register({ event: CesiumEvent.LEFT_CLICK })
      .subscribe(async event => {
        console.log(event);
        // const destination = this.coordinateConverter.screenToCartesian3(
        //   event.movement.endPosition
        // );
        const cartographicPosition = this.coordinateConverter.screenToCartographic(
          event.movement.endPosition
        );

        const updatedCartographicPosition = (
          await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [
            cartographicPosition
          ])
        )[0];

        // Add viewshed observer height
        updatedCartographicPosition.height += 1.6;

        console.log('updatedCartographicPosition', updatedCartographicPosition);

        const destination = Cesium.Cartographic.toCartesian(
          updatedCartographicPosition
        );

        const summitPosition = new Cesium.Cartesian3();
        const closestSummit = this.summits.features.reduce((acc, val) => {
          return Cesium.Cartesian3.distanceSquared(
            Cesium.Cartesian3.fromDegrees(
              acc.geometry.coordinates[0],
              acc.geometry.coordinates[1],
              acc.properties.ALT,
              Cesium.Ellipsoid.WGS84,
              summitPosition
            ),
            destination
          ) <
            Cesium.Cartesian3.distanceSquared(
              Cesium.Cartesian3.fromDegrees(
                val.geometry.coordinates[0],
                val.geometry.coordinates[1],
                val.properties.ALT,
                Cesium.Ellipsoid.WGS84,
                summitPosition
              ),
              destination
            )
            ? acc
            : val;
        });

        const bearing = this.coordinateConverter.bearingTo(
          updatedCartographicPosition,
          Cesium.Cartographic.fromDegrees(
            closestSummit.geometry.coordinates[0],
            closestSummit.geometry.coordinates[1]
          )
        );

        console.log('closestSummit', closestSummit);

        this.cameraService.cameraFlyTo({
          destination,
          orientation: {
            heading: Cesium.Math.toRadians(bearing),
            pitch: 0,
            roll: 0
          }
        });

        // this.snackbar.open(
        //   `Closest summit is ${closestSummit.properties.field_2}`
        // );

        this.stateService.send(new ViewpointEventView());
      });
  }

  ngOnDestroy() {
    this.stateService.stop();
  }

  //#region UI Events
  onExitClick() {
    this.stateService.send(new ViewpointEventExplore());
  }
  //#endregion
}
