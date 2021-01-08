import { Component, OnInit } from '@angular/core';
import { MapTerrainProviderOptions, ViewerConfiguration } from 'angular-cesium';
import { MatomoInjector, MatomoTracker } from 'ngx-matomo';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-root',
  template: `
    <ac-map>
      <!-- <ac-map-terrain-provider
        [provider]="MapTerrainProviderOptions.WorldTerrain"
      ></ac-map-terrain-provider> -->
      <app-summits></app-summits>
      <app-viewpoint></app-viewpoint>
    </ac-map>
  `,
  styleUrls: ['./app.component.scss'],
  providers: [ViewerConfiguration]
})
export class AppComponent implements OnInit {
  MapTerrainProviderOptions = MapTerrainProviderOptions;

  constructor(
    private viewerConf: ViewerConfiguration,
    private matomoInjector: MatomoInjector,
    private matomoTracker: MatomoTracker
  ) {
    // tslint:disable-next-line: max-line-length
    // See https://github.com/AnalyticalGraphicsInc/cesium/blob/master/Source/Widgets/BaseLayerPicker/createDefaultTerrainProviderViewModels.js
    const tarrainViewModels: any[] = [];
    tarrainViewModels.push(
      new Cesium.ProviderViewModel({
        name: 'Cesium World Terrain',
        iconUrl: Cesium.buildModuleUrl(
          'Widgets/Images/TerrainProviders/CesiumWorldTerrain.png'
        ),
        tooltip:
          'High-resolution global terrain tileset curated from several datasources and hosted by Cesium ion',
        category: 'Cesium ion',
        creationFunction: () => {
          return Cesium.createWorldTerrain({
            requestWaterMask: true,
            requestVertexNormals: true
          });
        }
      })
    );

    // tslint:disable-next-line: max-line-length
    // See https://github.com/AnalyticalGraphicsInc/cesium/blob/master/Source/Widgets/BaseLayerPicker/createDefaultImageryProviderViewModels.js
    const imageryViewModels: any[] = [];
    imageryViewModels.push(
      new Cesium.ProviderViewModel({
        name: 'Sentinel-2',
        iconUrl: Cesium.buildModuleUrl(
          'Widgets/Images/ImageryProviders/sentinel-2.png'
        ),
        tooltip: 'Sentinel-2 cloudless.',
        creationFunction: () => {
          return new Cesium.IonImageryProvider({ assetId: 3954 });
        }
      })
    );

    imageryViewModels.push(
      new Cesium.ProviderViewModel({
        name: 'Blue Marble',
        iconUrl: Cesium.buildModuleUrl(
          'Widgets/Images/ImageryProviders/blueMarble.png'
        ),
        tooltip: 'Blue Marble Next Generation July, 2004 imagery from NASA.',
        creationFunction: () => {
          return new Cesium.IonImageryProvider({ assetId: 3845 });
        }
      })
    );

    imageryViewModels.push(
      new Cesium.ProviderViewModel({
        name: 'Open\u00adStreet\u00adMap',
        iconUrl: Cesium.buildModuleUrl(
          'Widgets/Images/ImageryProviders/openStreetMap.png'
        ),
        tooltip:
          'OpenStreetMap (OSM) is a collaborative project to create a free editable map of the world.\nhttp://www.openstreetmap.org',
        creationFunction: () => {
          return new Cesium.OpenStreetMapImageryProvider({
            url: 'https://a.tile.openstreetmap.org/'
          });
        }
      })
    );

    this.viewerConf.viewerOptions = {
      animation: false,
      // terrainShadows: Cesium.ShadowMode.ENABLED,
      // terrainProvider: new Cesium.CesiumTerrainProvider({
      //   url: 'assets/terrain',
      //   credits:
      //     'Digitales Geländemodell (DGM) Österreich by [Geoland.at](https://geoland.at/)'
      // }),
      // imageryProvider: new Cesium.IonImageryProvider({ assetId: 3954 }),
      terrainProviderViewModels: tarrainViewModels,
      // terrainProvider: Cesium.createWorldTerrain(),
      imageryProviderViewModels: imageryViewModels,
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
      viewer.scene.highDynamicRange = false;
      viewer.scene.postProcessStages.fxaa.enabled = true;
      viewer.scene.fog.density = 0.00006;
      viewer.scene.skyAtmosphere.hueShift = -0.08;
      viewer.scene.skyAtmosphere.saturationShift = -0.3;
      viewer.scene.skyAtmosphere.brightnessShift = -0.2;

      const imageryLayers = viewer.imageryLayers;
      if (imageryLayers.length > 0) {
        const layer = imageryLayers.get(0);
        layer.brightness = 0.95;
        layer.contrast = 1.05;
        layer.saturation = 0.3;
        // layer.gamma = 1.0;
      }

      // Austrian Alps Viewshed 100 km
      const imageryLayer = viewer.imageryLayers.addImageryProvider(
        new Cesium.IonImageryProvider({ assetId: 121090 })
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

      viewer.scene.frameState.creditDisplay.addDefaultCredit(new Cesium.Credit('<a href="https://inspirespace.co/imprint/" target="_blank">Imprint</a>'))
    };
  }

  ngOnInit() {
    if (environment.matomo) {
      this.matomoInjector.init(environment.matomo.url, environment.matomo.id);
      this.matomoTracker.disableCookies();
    }
  }
}
