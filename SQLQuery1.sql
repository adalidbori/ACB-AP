-- Crear la base de datos
/*
CREATE DATABASE accountpayable;
GO

-- Crear tabla Company
CREATE TABLE Company (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyName NVARCHAR(255) NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Crear tabla Role
CREATE TABLE Role (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    RoleName NVARCHAR(100) NOT NULL UNIQUE,
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Crear tabla UserTable
CREATE TABLE UserTable (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    FirstName NVARCHAR(100) NOT NULL,
    LastName NVARCHAR(100) NOT NULL,
    WorkEmail NVARCHAR(255) NOT NULL UNIQUE,
    Phone NVARCHAR(20),
    PasswordHash NVARCHAR(255) NOT NULL,
    CompanyID INT NOT NULL,
    RoleID INT NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (CompanyID) REFERENCES Company(ID) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (RoleID) REFERENCES Role(ID) ON DELETE CASCADE ON UPDATE CASCADE
);
go

ALTER TABLE UserTable 
ADD Active BIT DEFAULT 1 NOT NULL; 
GO


-- Crear tabla UserTable
CREATE TABLE UserInvitation (
    ID INT IDENTITY(1,1) PRIMARY KEY,
	WorkEmail NVARCHAR(255) NOT NULL UNIQUE,
	CompanyID INT NOT NULL,
    RoleID INT NOT NULL,
	Token NVARCHAR(255) NOT NULL UNIQUE,
	Used BIT NOT NULL DEFAULT 0,
	CreatedAt DATETIME DEFAULT GETDATE(),
	ExpiresAt DATETIME
);
go

CREATE TABLE checks_db (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    check_number INT NOT NULL,
	CompanyID INT NOT NULL UNIQUE,
    [Timestamp] DATETIME DEFAULT GETDATE() 
	FOREIGN KEY (CompanyID) REFERENCES Company(ID) ON DELETE CASCADE ON UPDATE CASCADE
);


CREATE TABLE InvoiceStatus(
	ID INT IDENTITY(1,1) PRIMARY KEY,
	invoiceStatusName NVARCHAR(50),
	invoiceStatusCode int);
go

-- Crear la tabla (por ejemplo, Invoices)
CREATE TABLE Invoices (
    ID INT IDENTITY(1,1) PRIMARY KEY,       -- ID autoincremental
    docName NVARCHAR(255),                     -- name tipo texto
	timestampName NVARCHAR(255),                     -- name tipo texto
    vendor NVARCHAR(255),                   -- vendor tipo texto
	referenceNumber NVARCHAR(100),
    invoiceNumber NVARCHAR(100),            -- Invoice Number tipo texto
    invoiceStatus INT,                             -- status tipo número
    vendorAddress NVARCHAR(255),            -- vendor address tipo texto
    invoiceDate NVARCHAR(50),               -- invoice date tipo texto (puedes usar DATETIME si es apropiado)
    dueDate NVARCHAR(50),                   -- due date tipo texto (puedes usar DATETIME si es apropiado)
    fileURL NVARCHAR(255),                  -- file url tipo texto
    fileType NVARCHAR(50),                  -- file type tipo texto
	invoiceTotal NVARCHAR(50),
	checknumber NVARCHAR(50),
    CompanyID INT not null,
    FOREIGN KEY (CompanyID) REFERENCES Company(ID) ON DELETE CASCADE ON UPDATE CASCADE,
    [Timestamp] DATETIME DEFAULT GETDATE()  -- timestamp (fecha de creación, se asigna automáticamente)
);
GO

ALTER TABLE Invoices
ADD CONSTRAINT DF_Invoices_Vendor DEFAULT 'Unknown Vendor' FOR vendor;



-- Agregar la columna
ALTER TABLE Invoices
ADD LastModified DATETIME;
GO

-- Crear un trigger para actualizar LastModified cada vez que se modifique un registro
CREATE TRIGGER trg_UpdateLastModified
ON Invoices
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Invoices
    SET LastModified = GETDATE()
    FROM Invoices i
    INNER JOIN inserted ins ON i.ID = ins.ID;
END;
GO

CREATE TABLE Notes (
    ID INT IDENTITY(1,1) PRIMARY KEY,       -- ID autoincremental
	invoiceID INT,
	content NVARCHAR(MAX),
	userID INT,
    [Timestamp] DATETIME DEFAULT GETDATE()  -- timestamp (fecha de creación, se asigna automáticamente)
	FOREIGN KEY (invoiceID) REFERENCES Invoices(ID) ON DELETE CASCADE ON UPDATE CASCADE
);
GO

-- Insertar datos iniciales para Role
INSERT INTO Role (RoleName) VALUES ('Admin');
INSERT INTO Role (RoleName) VALUES ('User');
INSERT INTO Role (RoleName) VALUES ('Manager');

-- Insertar datos de ejemplo en Company
INSERT INTO Company (CompanyName) VALUES ('Microsoft');

SELECT 
            -- Tarjeta 1: Total a Pagar (Total Outstanding)
            (SELECT ISNULL(SUM(CAST(invoiceTotal AS MONEY)), 0) FROM Invoices WHERE invoiceStatus IN (1, 2, 3) AND CompanyID = 1) AS TotalOutstanding,

            -- Tarjeta 2: Facturas Pendientes (Pending Invoices)
            (SELECT COUNT(ID) FROM Invoices WHERE invoiceStatus IN (1, 2, 3) AND CompanyID = 1) AS PendingInvoices,

            -- Tarjeta 3: Pagado este Mes (Paid this Month)
            (SELECT ISNULL(SUM(CAST(invoiceTotal AS MONEY)), 0) FROM Invoices WHERE invoiceStatus = 4 AND MONTH(LastModified) = MONTH(GETDATE()) AND YEAR(LastModified) = YEAR(GETDATE()) AND CompanyID = 1) AS PaidThisMonth,

            -- Tarjeta 4: Facturas Atrasadas (Overdue Invoices)
            -- Corregido: Usamos TRY_CAST para evitar el error de conversión.
            (SELECT COUNT(ID) FROM Invoices WHERE invoiceStatus IN (1, 2, 3) AND TRY_CAST(dueDate AS DATE) < GETDATE() AND CompanyID = 1) AS OverdueInvoices;



SELECT
    I.*,        -- Selecciona todas las columnas de la tabla Invoices
    N.content   -- Y específicamente la columna 'content' de la tabla Notes
FROM
    Invoices AS I  -- Le damos un alias 'I' a Invoices para escribir menos
INNER JOIN
    Notes AS N ON I.ID = N.invoiceID -- Este es el "puente" que une las tablas
WHERE
    I.CompanyID = 3 AND I.invoiceStatus = 3;


	


CREATE TABLE InvoiceStatusHistory (
    -- ID autoincremental para cada registro de historial
    ID INT IDENTITY(1,1) PRIMARY KEY,

    -- ID de la factura a la que pertenece este registro de historial.
    -- Se establece una relación (clave foránea) con la tabla de Invoices.
    InvoiceID INT NOT NULL,

    -- El estado de la factura que se está registrando.
    -- Corresponde a los valores de tu columna Invoices.invoiceStatus (InProgress, Waiting Approval, etc.).
    StatusID INT NOT NULL,

    -- La fecha y hora exactas en que se realizó el cambio de estado.
    -- Se asigna automáticamente la fecha y hora actual al crear un nuevo registro.
    ChangeTimestamp DATETIME DEFAULT GETDATE(),

    -- Definición de la clave foránea para mantener la integridad de los datos.
    -- Si una factura se elimina, todos sus registros de historial se eliminarán en cascada.
    -- Si el ID de una factura se actualiza, también se actualizará aquí.
    FOREIGN KEY (InvoiceID) REFERENCES Invoices(ID) ON DELETE CASCADE ON UPDATE CASCADE
);
GO


CREATE TABLE CompanySettings (
    -- ID autoincremental para cada registro de configuración.
    ID INT IDENTITY(1,1) PRIMARY KEY,

    -- ID de la compañía a la que pertenece esta configuración.
    -- Se establece una relación única para asegurar que cada compañía tenga solo un registro.
    CompanyID INT NOT NULL UNIQUE,

    -- Datos del servidor SMTP. NVARCHAR para soportar cualquier tipo de caracter.
    SmtpHost NVARCHAR(255) NOT NULL,
    SmtpPort INT NOT NULL,
    SmtpUser NVARCHAR(255) NOT NULL,
    -- La dirección de correo electrónico a la que se enviarán las notificaciones.
    EmailTo NVARCHAR(255) NOT NULL,

    -- Timestamps para auditoría.
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),

    -- Definición de la clave foránea para mantener la integridad referencial con la tabla de compañías.
    FOREIGN KEY (CompanyID) REFERENCES Company(ID) ON DELETE CASCADE
);
*/