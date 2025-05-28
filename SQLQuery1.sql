-- Crear la base de datos
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

-- Crear tabla UserTable
CREATE TABLE UserInvitation (
    ID INT IDENTITY(1,1) PRIMARY KEY,
	WorkEmail NVARCHAR(255) NOT NULL UNIQUE,
	CompanyID INT NOT NULL,
    RoleID INT NOT NULL,
	Token NVARCHAR(255) NOT NULL UNIQUE,
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

-- Insertar usuario de ejemplo
INSERT INTO UserTable (FirstName, LastName, WorkEmail, Phone, PasswordHash, CompanyID, RoleID)
VALUES 
('Adalid', 'Bori', 'adalid@microsoft.com', '123-456-7890', '$2a$10$XEDCaTNVrQRZ/erKDsCnmejguLYd.a7zdWq09Qy4f9g0zeCcCR..u', 4, 1);
go



