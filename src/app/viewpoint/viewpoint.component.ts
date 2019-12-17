import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  CameraService,
  CesiumEvent,
  CoordinateConverter,
  MapEventsManagerService,
  MapsManagerService
} from 'angular-cesium';

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

@Component({
  selector: 'app-viewpoint',
  templateUrl: './viewpoint.component.html',
  styleUrls: ['./viewpoint.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewpointComponent implements OnInit {
  private summits: GeoJson;

  constructor(
    private snackbar: MatSnackBar,
    private eventManager: MapEventsManagerService,
    private coordinateConverter: CoordinateConverter,
    private cameraService: CameraService,
    private mapsManagerService: MapsManagerService,
    private http: HttpClient
  ) {}

  async ngOnInit() {
    this.summits = await this.http
      .get<GeoJson>('assets/alps_summits.geojson')
      .toPromise();

    console.log('summits', this.summits);

    const viewer = this.mapsManagerService.getMap().getCesiumViewer();
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

        this.snackbar.open(
          `Closest summit is ${closestSummit.properties.field_2}`
        );
      });
  }
}
