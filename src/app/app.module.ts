import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  AngularCesiumModule,
  AngularCesiumWidgetsModule
} from 'angular-cesium';
import { MatomoModule } from 'ngx-matomo';
import { AppComponent } from './app.component';
import { SummitsComponent } from './summits/summits.component';
import { ViewpointComponent } from './viewpoint/viewpoint.component';

@NgModule({
  declarations: [AppComponent, ViewpointComponent, SummitsComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AngularCesiumModule.forRoot(),
    AngularCesiumWidgetsModule,
    HttpClientModule,
    MatomoModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
