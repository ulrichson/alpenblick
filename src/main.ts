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
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJmZmNmZmUzNi0zM2U1LTQwODAtYjRlOS0wNDcxMDRiNDI4MmYiLCJpZCI6MTk4ODcsInNjb3BlcyI6WyJhc3IiLCJnYyJdLCJpYXQiOjE1NzY4NjQ2Nzl9.ufDy3VouYVuucgKYfGt-oFfVNSzfe8cBljY-QmnZZHE';

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch(err => console.error(err));
