import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AcNotification, ActionType } from 'angular-cesium';
import { from, Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-summits',
  template: `
    <ac-layer acFor="let summit of summits$" [context]="this" [store]="true">
      <ac-label-desc
        props="{
          position: summit.labelPosition,
          text: summit.labelText,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          font: '12px sans-serif',
          showBackground: true,
          translucencyByDistance: translucencyByDistance,
          scaleByDistance: scaleByDistance,
          distanceDisplayCondition: distanceDisplayCondition
        }"
      >
      </ac-label-desc>
      <ac-polyline-desc
        props="{
          positions: summit.polylinePositions,
          width: 2,
          material: Cesium.Color.WHITE,
          distanceDisplayCondition: distanceDisplayCondition
        }"
      >
      </ac-polyline-desc>
    </ac-layer>
  `,
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SummitsComponent {
  public Cesium = Cesium;

  public readonly translucencyByDistance = new Cesium.NearFarScalar(
    50000,
    1,
    150000,
    0.2
  );
  public readonly scaleByDistance = new Cesium.NearFarScalar(
    50000,
    1,
    150000,
    0.2
  );
  public readonly distanceDisplayCondition = new Cesium.DistanceDisplayCondition(
    0,
    150000
  );

  private readonly markerVerticalOffset = 200;

  private idCnt = 0;

  summits$: Observable<AcNotification> = from(
    this.http.get<any>('assets/alps_summits.geojson')
  ).pipe(
    switchMap(value => value.features as any),
    map((feature: any) => {
      const groundPosition = Cesium.Cartesian3.fromDegrees(
        feature.geometry.coordinates[0],
        feature.geometry.coordinates[1],
        0
      );
      const topPosition = Cesium.Cartesian3.fromDegrees(
        feature.geometry.coordinates[0],
        feature.geometry.coordinates[1],
        feature.properties.ALT + this.markerVerticalOffset
      );
      return {
        id: `summit-${this.idCnt++}`,
        actionType: ActionType.ADD_UPDATE,
        entity: {
          labelText: `${feature.properties.field_2}\n${feature.properties.AREA}\n${feature.properties.ALT}\u202Fm`,
          labelPosition: topPosition,
          polylinePositions: [groundPosition, topPosition]
        }
      } as AcNotification;
    })
  );

  constructor(private http: HttpClient) {}
}
