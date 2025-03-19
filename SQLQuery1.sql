-- Crear la base de datos
CREATE DATABASE accountpayable;
GO


-- Crear la tabla (por ejemplo, Invoices)
CREATE TABLE Invoices (
    ID INT IDENTITY(1,1) PRIMARY KEY,       -- ID autoincremental
    docName NVARCHAR(255),                     -- name tipo texto
	timestampName NVARCHAR(255),                     -- name tipo texto
    vendor NVARCHAR(255),                   -- vendor tipo texto
    invoiceNumber NVARCHAR(100),            -- Invoice Number tipo texto
    invoiceStatus INT,                             -- status tipo número
    vendorAddress NVARCHAR(255),            -- vendor address tipo texto
    invoiceDate NVARCHAR(50),               -- invoice date tipo texto (puedes usar DATETIME si es apropiado)
    dueDate NVARCHAR(50),                   -- due date tipo texto (puedes usar DATETIME si es apropiado)
    fileURL NVARCHAR(255),                  -- file url tipo texto
    fileType NVARCHAR(50),                  -- file type tipo texto
	invoiceTotal NVARCHAR(50),
    [Timestamp] DATETIME DEFAULT GETDATE()  -- timestamp (fecha de creación, se asigna automáticamente)
);
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

select * from Invoices
go

SELECT invoiceNumber, COUNT(*) AS occurrences
FROM Invoices where invoiceStatus = 
GROUP BY invoiceNumber
HAVING COUNT(*) > 1;
go

select * from Notes
go


delete from Invoices
go

delete from Notes
go

truncate table Invoices
go

DROP TABLE Notes;
go

MERGE INTO Notes AS target
USING (SELECT 1 AS invoiceID, 'test' AS content, 3 AS userID) AS source
ON target.invoiceID = source.invoiceID
WHEN MATCHED THEN
    UPDATE SET content = source.content
WHEN NOT MATCHED THEN
    INSERT (invoiceID, content, userID)
    VALUES (source.invoiceID, source.content, source.userID);
GO


-- Crear tabla Company
CREATE TABLE Company (
    CompanyID INT IDENTITY(1,1) PRIMARY KEY,
    CompanyName NVARCHAR(255) NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Crear tabla Role
CREATE TABLE Role (
    RoleID INT IDENTITY(1,1) PRIMARY KEY,
    RoleName NVARCHAR(100) NOT NULL UNIQUE,
    CreatedAt DATETIME DEFAULT GETDATE()
);

-- Crear tabla UserTable
CREATE TABLE UserTable (
    UserID INT IDENTITY(1,1) PRIMARY KEY,
    FirstName NVARCHAR(100) NOT NULL,
    LastName NVARCHAR(100) NOT NULL,
    WorkEmail NVARCHAR(255) NOT NULL UNIQUE,
    Phone NVARCHAR(20),
    PasswordHash NVARCHAR(255) NOT NULL,
    CompanyID INT NOT NULL,
    RoleID INT NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (CompanyID) REFERENCES Company(CompanyID) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (RoleID) REFERENCES Role(RoleID) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Insertar datos iniciales para Role
INSERT INTO Role (RoleName) VALUES ('Admin');
INSERT INTO Role (RoleName) VALUES ('User');
INSERT INTO Role (RoleName) VALUES ('Manager');

-- Insertar datos de ejemplo en Company
INSERT INTO Company (CompanyName) VALUES ('OpenAI');
INSERT INTO Company (CompanyName) VALUES ('Microsoft');

-- Insertar usuario de ejemplo
INSERT INTO UserTable (FirstName, LastName, WorkEmail, Phone, PasswordHash, CompanyID, RoleID)
VALUES 
('John', 'Doe', 'john.doe@openai.com', '123-456-7890', 'hashed_password_example', 1, 1);

select * from Role


