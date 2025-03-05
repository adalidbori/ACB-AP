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
);
GO

select * from Invoices
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

