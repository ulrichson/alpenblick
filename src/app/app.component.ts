import { Component, OnInit } from '@angular/core';
import { ViewerConfiguration } from 'angular-cesium';
import { MatomoInjector, MatomoTracker } from 'ngx-matomo';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [ViewerConfiguration]
})
export class AppComponent implements OnInit {
  constructor(
    private viewerConf: ViewerConfiguration,
    private matomoInjector: MatomoInjector,
    private matomoTracker: MatomoTracker
  ) {
    this.viewerConf.viewerOptions = {
      animation: false,
      // terrainShadows: Cesium.ShadowMode.ENABLED,
      // terrainProvider: new Cesium.CesiumTerrainProvider({
      //   url: 'assets/terrain',
      //   credits:
      //     'Digitales Geländemodell (DGM) Österreich by [Geoland.at](https://geoland.at/)'
      // }),
      terrainProvider: Cesium.createWorldTerrain(),
      timeline: false,
      shadows: false,
      // baseLayerPicker: false, // There're rendering issues when this is included...very strange
      homeButton: false,
      selectionIndicator: false,
      projectionPicker: false,
      scene3DOnly: true,
      requestRenderMode: true
    };

    this.viewerConf.viewerModifier = viewer => {
      // Imagery
      viewer.scene.highDynamicRange = true;
      viewer.scene.postProcessStages.fxaa.enabled = true;
      viewer.scene.fog.density = 8.0e-5;
      viewer.scene.skyAtmosphere.hueShift = -0.08;
      viewer.scene.skyAtmosphere.saturationShift = -0.3;
      viewer.scene.skyAtmosphere.brightnessShift = -0.2;

      const imageryLayers = viewer.imageryLayers;
      if (imageryLayers.length > 0) {
        const layer = imageryLayers.get(0);
        layer.brightness = 0.9;
        layer.contrast = 1.1;
        layer.saturation = 0.3;
        layer.gamma = 1.0;
      }

      // Austrian Alps Viewshed 100 km
      const imageryLayer = viewer.imageryLayers.addImageryProvider(
        new Cesium.IonImageryProvider({ assetId: 61602 })
      );

      viewer.zoomTo(imageryLayer);

      // const color = Cesium.Color.fromCssColorString('#ff00fb');
      // const dataSource = Cesium.GeoJsonDataSource.load(
      //   'assets/alps_summits.geojson',
      //   {
      //     clampToGround: true,
      //     fill: color
      //   }
      // );
      // viewer.dataSources.add(dataSource);
    };
  }

  ngOnInit() {
    if (environment.matomo) {
      this.matomoInjector.init(environment.matomo.url, environment.matomo.id);
      this.matomoTracker.disableCookies();
    }
  }
}
