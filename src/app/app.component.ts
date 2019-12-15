import { Component } from '@angular/core';
import { ViewerConfiguration } from 'angular-cesium';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [ViewerConfiguration]
})
export class AppComponent {
  title = 'alpenblick';

  constructor(private viewerConf: ViewerConfiguration) {
    this.viewerConf.viewerOptions = {
      animation: false,
      terrainShadows: Cesium.ShadowMode.ENABLED,
      terrainProvider: Cesium.createWorldTerrain(),
      timeline: false,
      shadows: false
    };

    this.viewerConf.viewerModifier = viewer => {
      viewer.scene.highDynamicRange = true;
      viewer.scene.postProcessStages.fxaa.enabled = true;
    };
  }
}
