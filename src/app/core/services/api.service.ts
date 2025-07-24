import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { API_CONFIG } from '../../config/api.config';
import { ValidationRequest, ValidationResponse, ApiResponse, ApiError } from '../models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(private http: HttpClient) { }

  /**
   * Valida facialmente al usuario enviando datos al backend
   */
  validarFacial(
    sessionId: string, 
    fotoBase64: string, 
    intento: number, 
    tipoMovimiento: string, 
    exitoso: boolean, 
    parpadeos: number
  ): Observable<ValidationResponse> {
    
    const imagenBase64 = fotoBase64.replace(/^data:image\/\w+;base64,/, '');
    
    const request: ValidationRequest = {
      identificador: sessionId,
      intento,
      tipoMovimiento,
      exitoso,
      timestamp: new Date().toISOString(),
      fotoBase64: imagenBase64,
      parpadeos
    };

    return this.http.post<any>(API_CONFIG.BASE_URL, request, {
      headers: new HttpHeaders(API_CONFIG.HEADERS)
    }).pipe(
      map(response => this.parseApiResponse(response)),
      catchError(this.handleError)
    );
  }

  /**
   * Parsea la respuesta de la API
   */
  private parseApiResponse(response: any): ValidationResponse {
    console.log('🔍 Respuesta raw del backend:', response);
    
    // Si la respuesta ya es un objeto (caso más común)
    if (typeof response === 'object' && response !== null) {
      return response;
    }
    
    // Si la respuesta tiene estructura { body: ... }
    if (response && typeof response.body === 'string') {
      try {
        return JSON.parse(response.body);
      } catch (e) {
        console.error('❌ Error al parsear body:', e);
        return { success: false, message: 'Error al procesar respuesta' };
      }
    }
    
    // Si la respuesta es un string JSON
    if (typeof response === 'string') {
      try {
        return JSON.parse(response);
      } catch (e) {
        console.error('❌ Error al parsear respuesta string:', e);
        return { success: false, message: 'Error al procesar respuesta' };
      }
    }
    
    console.error('❌ Formato de respuesta no reconocido:', response);
    return { success: false, message: 'Formato de respuesta no válido' };
  }

  /**
   * Maneja errores de la API
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    const apiError: ApiError = {
      message: error.error?.message || 'Error desconocido',
      statusCode: error.status,
      timestamp: new Date().toISOString()
    };

    console.error('❌ Error en la petición:', apiError);
    return throwError(() => apiError);
  }
} 