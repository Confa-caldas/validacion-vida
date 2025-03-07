import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CameraComponent } from "./camera/camera.component";
import { LiveCheckComponent } from "./live-check/live-check.component";
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CameraComponent, LiveCheckComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'camara-video-validacion';
  
}
