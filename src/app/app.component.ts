import { Component } from '@angular/core';
import { LivenessDetectionComponent } from "./features/liveness-detection/components/liveness-detection.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LivenessDetectionComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'camara-video-validacion';
}
