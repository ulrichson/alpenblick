import { Component } from '@angular/core';
import { ViewerConfiguration } from 'angular-cesium';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [ViewerConfiguration]
})
export class AppComponent {
  constructor(private viewerConf: ViewerConfiguration) {
    this.viewerConf.viewerOptions = {
      animation: false,
      // terrainShadows: Cesium.ShadowMode.ENABLED,
      terrainProvider: Cesium.createWorldTerrain(),
      timeline: false,
      shadows: false
    };

    this.viewerConf.viewerModifier = viewer => {
      viewer.scene.highDynamicRange = true;
      viewer.scene.postProcessStages.fxaa.enabled = true;
      viewer.scene.fog.density = 8.0e-5;
      viewer.scene.skyAtmosphere.hueShift = -0.08;
      viewer.scene.skyAtmosphere.saturationShift = -0.3;
      viewer.scene.skyAtmosphere.brightnessShift = -0.2;

      const imageryLayers = viewer.imageryLayers;
      if (imageryLayers.length > 0) {
        const layer = imageryLayers.get(0);
        layer.brightness = 0.4;
        layer.contrast = 1.2;
        layer.hue = 0;
        layer.saturation = 0.3;
        layer.gamma = 0.8;
      }

      // Austrian Alps Viewshed 100 km
      const imageryLayer = viewer.imageryLayers.addImageryProvider(
        new Cesium.IonImageryProvider({ assetId: 61602 })
      );

      viewer.zoomTo(imageryLayer);
    };
  }
}
