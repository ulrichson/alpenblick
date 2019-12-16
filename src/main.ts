import 'hammerjs';
import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

Cesium.buildModuleUrl.setBaseUrl('/assets/cesium/');
Cesium.Ion.defaultAccessToken =
  // tslint:disable-next-line: max-line-length
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhMzMzZTg1ZS04YjgyLTQ4NjYtYjc3Zi1iMmExNDdmMjllMjEiLCJpZCI6MTk4ODcsInNjb3BlcyI6WyJhc3IiLCJnYyJdLCJpYXQiOjE1NzY0MjE4NTd9.uaXQ6d6AORmZ2mG-KvJpZfBU1BWNX4JEAo9Kp-jfB0Y';

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch(err => console.error(err));
