import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class LiveCheckService {

  constructor(private http: HttpClient) { }

  validacionFacial(fotoBase64: string) {
    const apiUrl = 'https://api-facial.confa.co/identificarvalidar'; // ✅ URL relativa al proxy
    const imagenBase64 = fotoBase64.replace(/^data:image\/\w+;base64,/, '');
   
    console.log("hola "+imagenBase64);
    const XAPIKEY = "qfdmzeFdxN2VetG1dYgRB4jLrxHrLTveaxss0aMH";
  
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-KEY': XAPIKEY
    });
  
    const body = {
      "imgdata":imagenBase64,
        "excepcion": "ojos-boca-dimension-gafasDeSol",
  "tipoValidacion": "validacion"
    };
  
    this.http.post(apiUrl, body, { headers }).subscribe({
      next: (response: any) => {
        console.log('✅ Respuesta del servidor:', response);
      },
      error: (error) => {
        console.error('❌ Error en la solicitud:', error);
      }
    });
  }
  
}
