// --- Mocks MUST be declared BEFORE importing the module under test ---
const mockUse = jest.fn();
const mockOn = jest.fn();
const mockServerCtor = jest.fn().mockImplementation((httpServerArg: any, opts: any) => {
  // Simula instancia de Server con métodos use/on que guardamos en jest fns
  return {
    use: mockUse,
    on: mockOn,
    // incluir to/emit si algún test lo requiere
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };
});

// Mock del paquete 'socket.io' exportando Server que usamos
jest.mock("socket.io", () => {
  return {
    Server: mockServerCtor,
  };
});

// Mock del middleware y del registerRoomHandlers para espiar llamadas
const mockSocketAuthMiddleware = jest.fn();
jest.mock("../src/middleware/socketAuth", () => ({
  socketAuthMiddleware: mockSocketAuthMiddleware,
}));

const mockRegisterRoomHandlers = jest.fn();
jest.mock("../src/socket/room.handlers", () => ({
  registerRoomHandlers: mockRegisterRoomHandlers,
}));

// Ahora importamos la función a probar
import { initSocketServer } from "../src/socket";

describe("initSocketServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should instantiate socket.io Server with httpServer and cors options", () => {
    const fakeHttpServer = { some: "server" };

    const io = initSocketServer(fakeHttpServer);

    // Verifica que construimos Server con los argumentos adecuados
    expect(mockServerCtor).toHaveBeenCalledTimes(1);
    expect(mockServerCtor).toHaveBeenCalledWith(fakeHttpServer, {
      cors: { origin: "*", methods: ["GET", "POST"] },
    });

    // Y que la función devolvió la instancia creada
    expect(io).toBeDefined();
    expect(io.use).toBe(mockUse);
    expect(io.on).toBe(mockOn);
  });

  it("should apply socketAuthMiddleware via io.use", () => {
    const fakeHttpServer = {};
    initSocketServer(fakeHttpServer);

    // Debe haberse llamado io.use(socketAuthMiddleware)
    expect(mockUse).toHaveBeenCalledWith(mockSocketAuthMiddleware);
  });

  it("should register connection handler that logs and calls registerRoomHandlers", () => {
    // Preparar: interceptar la callback que se registró en io.on("connection", cb)
    const fakeHttpServer = {};

    // Reemplazamos mockOn para capturar el callback pasado para 'connection'
    // mockOn fue creado arriba; llamamos initSocketServer para que lo use
    initSocketServer(fakeHttpServer);

    // mockOn debería haber sido llamado con ('connection', callback)
    expect(mockOn).toHaveBeenCalled();
    // Buscar el par que tenga 'connection' como primer arg
    const call = mockOn.mock.calls.find((c) => c[0] === "connection");
    expect(call).toBeDefined();

    const connectionHandler = call![1];
    expect(typeof connectionHandler).toBe("function");

    // Simular socket con data.user.name
    const fakeSocket = { data: { user: { name: "Pepito", id: "u1" } } };

    // Espiar console.log
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    // Ejecutar handler
    connectionHandler(fakeSocket);

    // Debe loggear la conexión
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("🟢 Connected: Pepito"));

    // Debe haber llamado registerRoomHandlers con la instancia io y el socket
    // El primer arg pasado a registerRoomHandlers debe ser la instancia retornada por mockServerCtor
    const createdIoInstance = mockServerCtor.mock.results[0].value;
    expect(mockRegisterRoomHandlers).toHaveBeenCalledWith(createdIoInstance, fakeSocket);

    logSpy.mockRestore();
  });
});