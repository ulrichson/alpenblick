import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
  AngularCesiumModule,
  AngularCesiumWidgetsModule
} from 'angular-cesium';
import { AppComponent } from './app.component';
import { ViewpointComponent } from './viewpoint/viewpoint.component';

@NgModule({
  declarations: [AppComponent, ViewpointComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AngularCesiumModule.forRoot(),
    AngularCesiumWidgetsModule,
    HttpClientModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSnackBarModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
