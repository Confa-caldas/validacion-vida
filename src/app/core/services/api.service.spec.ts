
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { API_CONFIG } from '../../config/api.config';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService]
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should send validation request with correct data', () => {
    const mockRequest = {
      sessionId: 'test-session',
      fotoBase64: 'data:image/png;base64,test-image',
      intento: 1,
      tipoMovimiento: 'izquierda',
      exitoso: true,
      parpadeos: 2
    };

    const mockResponse = {
      score: 85,
      estadoFinal: 'APROBADO',
      success: true
    };

    service.validarFacial(
      mockRequest.sessionId,
      mockRequest.fotoBase64,
      mockRequest.intento,
      mockRequest.tipoMovimiento,
      mockRequest.exitoso,
      mockRequest.parpadeos
    ).subscribe(response => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(API_CONFIG.BASE_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Content-Type')).toBe('application/json');

    const expectedBody = {
      identificador: mockRequest.sessionId,
      intento: mockRequest.intento,
      tipoMovimiento: mockRequest.tipoMovimiento,
      exitoso: mockRequest.exitoso,
      timestamp: jasmine.any(String),
      fotoBase64: 'test-image', // Base64 sin el prefijo
      parpadeos: mockRequest.parpadeos
    };

    expect(req.request.body).toEqual(jasmine.objectContaining(expectedBody));
    req.flush({ body: JSON.stringify(mockResponse) });
  });

  it('should handle API errors correctly', () => {
    const mockRequest = {
      sessionId: 'test-session',
      fotoBase64: 'data:image/png;base64,test-image',
      intento: 1,
      tipoMovimiento: 'izquierda',
      exitoso: true,
      parpadeos: 2
    };

    service.validarFacial(
      mockRequest.sessionId,
      mockRequest.fotoBase64,
      mockRequest.intento,
      mockRequest.tipoMovimiento,
      mockRequest.exitoso,
      mockRequest.parpadeos
    ).subscribe({
      next: () => fail('Should have failed'),
      error: (error) => {
        expect(error.statusCode).toBe(500);
        expect(error.message).toBe('Error del servidor');
      }
    });

    const req = httpMock.expectOne(API_CONFIG.BASE_URL);
    req.flush(
      { message: 'Error del servidor' },
      { status: 500, statusText: 'Internal Server Error' }
    );
  });

  it('should parse string response correctly', () => {
    const mockResponse = {
      score: 90,
      estadoFinal: 'APROBADO'
    };

    service.validarFacial('test', 'test-image', 1, 'izquierda', true, 2)
      .subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

    const req = httpMock.expectOne(API_CONFIG.BASE_URL);
    req.flush({ body: JSON.stringify(mockResponse) });
  });
}); 