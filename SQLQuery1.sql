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
                ui.ID,
                ui.WorkEmail,
                c.CompanyName,
                r.RoleName,
                FORMAT(ui.CreatedAt, 'MM/dd/yyyy') AS CreatedAt,
                FORMAT(ui.ExpiresAt, 'MM/dd/yyyy') AS ExpiresAt
            FROM 
                UserInvitation ui
            INNER JOIN 
                Company c ON ui.CompanyID = c.ID
            INNER JOIN 
                Role r ON ui.RoleID = r.ID



-- Consulta para todas las tarjetas en una sola llamada
SELECT 
    -- Tarjeta 1: Total a Pagar (Total Outstanding)
    -- Suma de los totales de todas las facturas no pagadas (estado 1, 2, o 3)
    (SELECT SUM(CAST(invoiceTotal AS MONEY)) FROM Invoices WHERE invoiceStatus IN (1, 2, 3)) AS TotalOutstanding,

    -- Tarjeta 2: Facturas Pendientes (Pending Invoices)
    -- Conteo de todas las facturas no pagadas
    (SELECT COUNT(ID) FROM Invoices WHERE invoiceStatus IN (1, 2, 3)) AS PendingInvoices,

    -- Tarjeta 3: Pagado este Mes (Paid this Month)
    -- Suma de los totales de facturas pagadas (estado 4) durante el mes y año actual
    (SELECT SUM(CAST(invoiceTotal AS MONEY)) FROM Invoices WHERE invoiceStatus = 4 AND MONTH(LastModified) = MONTH(GETDATE()) AND YEAR(LastModified) = YEAR(GETDATE())) AS PaidThisMonth,

    -- Tarjeta 4: Facturas Atrasadas (Overdue Invoices)
    -- Conteo de facturas no pagadas cuya fecha de vencimiento ya pasó
    (SELECT COUNT(ID) FROM Invoices WHERE invoiceStatus IN (1, 2, 3) AND CAST(dueDate AS DATE) < GETDATE()) AS OverdueInvoices;



-- Conteo de facturas PAGADAS por mes (del año en curso)
SELECT 
    FORMAT(LastModified, 'yyyy-MM') AS PaidMonth,
    COUNT(ID) AS NumberOfInvoices
FROM 
    Invoices
WHERE 
    invoiceStatus = 4 or invoiceStatus = 6 -- Filtra solo las facturas pagadas
    AND YEAR(LastModified) = YEAR(GETDATE()) -- Filtra por el año actual
GROUP BY 
    FORMAT(LastModified, 'yyyy-MM')
ORDER BY 
    PaidMonth;


-- Suma de los montos pagados por mes (del año en curso)
SELECT 
    FORMAT(LastModified, 'yyyy-MM') AS PaymentMonth,
    SUM(CAST(invoiceTotal AS MONEY)) AS TotalPaid
FROM 
    Invoices
WHERE 
    invoiceStatus = 4 or invoiceStatus = 6 -- Filtra solo las facturas pagadas
    AND YEAR(LastModified) = YEAR(GETDATE()) -- Filtra por el año actual
GROUP BY 
    FORMAT(LastModified, 'yyyy-MM')
ORDER BY 
    PaymentMonth;



