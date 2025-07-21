import { Component } from '@angular/core';
import { LivenessDetectionComponent } from "./features/liveness-detection/components/liveness-detection.component";

@Component({
  selector: 'app-root',
  imports: [LivenessDetectionComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'camara-video-validacion';
}
