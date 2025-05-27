import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LiveCheckService {

  constructor(private http: HttpClient) { }

  validarFacial(sessionId: string, fotoBase64: string, intento: number, tipoMovimiento: string, exitoso: boolean, parpadeos: number): Observable<any> {
 
    const apiUrl = 'https://lo3llmhfb0.execute-api.us-east-1.amazonaws.com/PY/pruebadevida'; // ✅ URL relativa al proxy
    const imagenBase64 = fotoBase64.replace(/^data:image\/\w+;base64,/, '');
    const XAPIKEY = "C4Vq8h3L1r9nxz1fKDSoR4kaaL59ks2E8axGpXSG";
 
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-KEY': XAPIKEY
    });
 
    const body = {
      identificador: sessionId, // o el ID que estés usando
      intento,
      tipoMovimiento,
      exitoso,
      timestamp: new Date().toISOString(),
      fotoBase64: imagenBase64,
      parpadeos: parpadeos
    };
  return this.http.post(apiUrl, body, { headers });
  }
  
}
