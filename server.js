const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch"); // Asegúrate de instalar node-fetch versión 2: npm install node-fetch@2
const sql = require('mssql');
const pdf4me = require('pdf4me')
const https = require('https');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require("cookie-parser");
const { GoogleGenerativeAI } = require('@google/generative-ai');



require("dotenv").config();
const nodemailer = require('nodemailer');

const USER = process.env.USER;
const PASSWORD = process.env.PASSWORD;
const SERVER = process.env.SERVER;
const DATABASE = process.env.DATABASE;
const PORT = parseInt(process.env.PORT, 10);
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_TO = process.env.EMAIL_TO;
const JWT_SECRET = process.env.JWT_SECRET;
const GEMINI_KEY = process.env.GEMINI_KEY;
const ROOT_DOMAIN = process.env.ROOT_DOMAIN;
const DOMAIN_PORT = process.env.DOMAIN_PORT;

const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' });


const connection = {
  user: USER,
  password: PASSWORD,
  server: SERVER,
  database: DATABASE,
  port: PORT,
  options: {
    encrypt: false
  }
};

// Función para probar la conexión y obtener el pool
async function testConnection() {
  try {
    const pool = await sql.connect(connection);
    console.log('Conexión a SQL Server exitosa');
    return pool;
  } catch (error) {
    console.error('Error conectando a SQL Server:', error);
    throw error;
  }
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: false,       // true solo si usas el puerto 465
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    // Microsoft recomienda TLS 1.2; este flag permite negociar correctamente
    ciphers: 'TLSv1.2'
  }
});

transporter.verify()
  .then(() => console.log('✅ Conexión a Office365 SMTP OK'))
  .catch(err => console.error('❌ Error al conectar Office365 SMTP:', err));

//const { BlobServiceClient } = require("@azure/storage-blob");
//const { StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require("@azure/storage-blob");
const { BlobServiceClient, BlobClient, StorageSharedKeyCredential, BlobSASPermissions, generateBlobSASQueryParameters } = require('@azure/storage-blob');



const app = express();
const port = 3000;

// Configuración de CORS y parsers
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Configuración de Multer para almacenar temporalmente el archivo
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Guarda el archivo en la carpeta "uploads"
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Configurar Azure Blob Storage
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const OPENAI_KEY = process.env.OPENAI_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER;
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const AZURE_OCR_ENDPOINT = process.env.AZURE_OCR_ENDPOINT;
const AZURE_OCR_KEY = process.env.AZURE_OCR_KEY;
const PDF4ME = process.env.PDF4ME;
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);

async function uploadFileToAzure(localFilePath, blobName, contentType) {
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists({ access: "container" });
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadFile(localFilePath, {
    blobHTTPHeaders: {
      blobContentType: contentType,
      blobContentDisposition: "inline",
    },
  });
  return blockBlobClient.url;
}

// Ruta para subir archivos: se guarda localmente, se sube a Azure y se elimina el archivo local
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No se ha subido ningún archivo." });
  }

  const localFilePath = req.file.path;
  const blobName = req.file.filename;

  try {
    const azureUrl = await uploadFileToAzure(localFilePath, blobName, req.file.mimetype);

    // Intenta eliminar el archivo local; si falla, se registra el error pero no se interrumpe la respuesta
    try {
      await fs.promises.unlink(localFilePath);
    } catch (unlinkError) {
      console.error("Error eliminando el archivo local:", unlinkError);
    }

    res.json({ filename: blobName, url: azureUrl });
  } catch (error) {
    console.error("Error subiendo a Azure:", error);
    res.status(500).json({ error: "Error al subir el archivo a Azure." });
  }
});

// Ruta para procesar la URL del archivo en Azure y extraer texto sin guardarlo localmente
app.post("/get-operationLocation", async (req, res) => {
  let { filePath } = req.body;
  const url = generateSasUrlForBlob(filePath);
  if (!url) {
    return res.status(400).json({ error: "No se proporcionó la URL del archivo." });
  }

  // Validar que filePath sea una URL
  if (!url.startsWith("http")) {
    return res.status(400).json({ error: "El filePath debe ser una URL." });
  }
  try {
    const apiUrl = AZURE_OCR_ENDPOINT;
    const subscriptionKey = AZURE_OCR_KEY;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": subscriptionKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });
    const operationLocation = response.headers.get("operation-location");

    if (!operationLocation) {
      return res.status(500).json({ error: "No se pudo obtener la ubicación de la operación." });
    }

    res.json({ mensaje: "Llamada iniciada", operationLocation });
    return operationLocation;
  } catch (error) {
    console.error("Error al extraer texto del archivo desde la URL:", error);
    return res.status(500).json({ error: "Error al procesar el archivo." });
  }
});

app.post("/extractpdf", async (req, res) => {
  try {
    // Reemplaza 'YOUR_API_KEY' por tu clave real
    const { url, range } = req.body;
    const pdf4meClient = pdf4me.createClient(PDF4ME);

    // Descarga el PDF y conviértelo a Base64
    const pdfBase64 = await downloadPDF(url);

    // Crea el objeto de solicitud usando docData
    const extractReq = {
      document: {
        docData: pdfBase64
      },
      extractAction: {
        extractPages: [range] // Extrae la página 1
      }
    };

    // Llama a la API de pdf4me para extraer el PDF
    const extractRes = await pdf4meClient.extract(extractReq);

    // Convierte el PDF extraído de Base64 a Buffer y lo guarda en disco
    const pdfDocument = Buffer.from(extractRes.document.docData, 'base64');
    //fs.writeFileSync(path.join(__dirname, 'extractedPdf.pdf'), pdfDocument);

    // Envía el PDF extraído en la respuesta
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=extractedPdf.pdf");
    return res.send(pdfDocument); // Usamos return para detener la ejecución
  } catch (error) {
    console.error("Error al extraer el PDF:", error);
    res.status(500).send("Error al extraer el PDF");
  }
});

function downloadPDF(url) {
  const sasUrl = generateSasUrlForBlob(url)
  return new Promise((resolve, reject) => {
    https.get(sasUrl, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Error al descargar PDF, status code: ${res.statusCode}`));
      }
      const data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        const base64 = buffer.toString('base64');
        resolve(base64);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function pollForResult(operationLocation) {
  let result;
  let counter = 0;
  // Polling: se repite la consulta hasta que el estado sea 'succeeded' o 'failed'
  while (counter < 30) {
    const response = await fetch(operationLocation, {
      method: "GET",
      headers: {
        "Ocp-Apim-Subscription-Key": process.env.AZURE_OCR_KEY // Asegúrate de usar tu clave aquí
      }
    });
    result = await response.json();

    if (result.status === "succeeded") {
      // El análisis se completó: retorna los resultados (normalmente en result.analyzeResult.readResults)
      return result.analyzeResult.readResults;
    } else if (result.status === "failed") {
      // Muestra detalles en la consola y lanza un error con la información
      console.error("La operación falló. Detalles:", result);
      throw new Error("La operación falló, status failed. Detalles: " + JSON.stringify(result));
    }

    // Espera un segundo antes de la siguiente consulta
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("status: " + result.status);
    counter++;
  }
  // Si se sale del bucle sin obtener un status 'succeeded' ni 'failed'
  console.error("La operación no completó en 10 intentos. Última respuesta:", result);
  throw new Error("La operación falló después de 10 intentos. Detalles: " + JSON.stringify(result));
}


// Ejemplo de uso en una ruta Express:
app.post("/extract-text", async (req, res) => {
  const { operationLocation } = req.body;

  if (!operationLocation) {
    return res.status(400).json({ error: "Falta la URL de la operación." });
  }

  try {
    const readResults = await pollForResult(operationLocation);
    res.json({ results: readResults });
  } catch (error) {
    console.error("Error al obtener el resultado:", error);
    res.status(500).json({ error: "Error al obtener el resultado." });
  }
});



// Ruta para manejar la solicitud POST
app.post('/open-document', (req, res) => {
  try {
    const { url } = req.body; // Obtiene la URL del cuerpo de la solicitud

    if (!url) {
      return res.status(400).json({ error: "La propiedad 'url' es requerida." });
    }

    const newUrl = generateSasUrlForBlob(url); // Genera la nueva URL
    res.json({ newUrl }); // Envía la nueva URL en la respuesta
  } catch (error) {
    console.error("Error al procesar la solicitud:", error);
    res.status(500).json({ error: "Error al procesar la solicitud." });
  }
});

function generateSasUrlForBlob(blobUrl) {

  // Parsear la URL para extraer el nombre del contenedor y del blob
  const urlObj = new URL(blobUrl);
  const pathParts = urlObj.pathname.split('/').filter(Boolean); // Remueve cadenas vacías
  const containerName = pathParts[0];
  const blobName = pathParts.slice(1).join('/');

  // Crear las credenciales compartidas
  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);

  const now = new Date();
  const sasOptions = {
    containerName,
    blobName,
    permissions: BlobSASPermissions.parse("rd"), // permiso de lectura
    startsOn: new Date(now.getTime() - 5 * 60 * 1000), // permite un desfase de 5 minutos
    expiresOn: new Date(now.getTime() + 10 * 60 * 1000) // válido por 10 minutos
  };

  // Generar el SAS token
  const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();

  // Retornar la URL del blob con el SAS token concatenado
  return `${blobUrl}?${sasToken}`;
}

async function deleteFile(fileUrl) {
  const sasUrl = generateSasUrlForBlob(fileUrl);
  // Crear un BlobClient utilizando la URL con SAS
  const blobClient = new BlobClient(sasUrl);
  // Llamar al método delete para eliminar el blob
  await blobClient.delete();
}

// Ruta en Express para eliminar el blob
app.delete('/eliminar-blob', async (req, res) => {
  try {
    const { urls } = req.body;
    if (!urls) {
      return res.status(400).json({ error: "No se proporcionó ninguna url." });
    }
    const urlArray = Array.isArray(urls) ? urls : [urls];
    for (const url of urlArray) {
      await deleteFile(url);
    }
    res.status(200).json({ message: 'Blob eliminado correctamente' });
  } catch (error) {
    console.error("Error al eliminar el blob:", error);
    res.status(500).json({ error: 'Error al eliminar el blob' });
  }
});

// Llamada a ChatGPT
app.post("/chatgpt", async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: "No se proporcionó el texto." });
  }
  try {
    const apiUrl = "https://api.openai.com/v1/chat/completions";
    const chatResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": OPENAI_KEY
      },
      body: JSON.stringify({
        model: "o3-mini",
        messages: [
          {
            role: "system",
            content: "You are an assistant specialized in extracting invoice information. Based on the text provided, return ONLY a JSON object with the following keys: { 'invoices' : [ {'vendor_name', 'reference_number' (it may appear as a reference number or file number), 'invoice_date' (formatted as MM/DD/YYYY), 'vendor_address', 'invoice_number', 'invoice_due_date' (formatted as MM/DD/YYYY), 'invoice_total' (formatted as a decimal number using a period (.) as the decimal separator and removing any other characters from the decimals), 'pages' (The actual range of pages in the document where the invoice appears, formatted as 1-1, 2-3, 5-6, etc, based on the document's physical page order and also based on the line that says 'This is the end of page # of page')} ]}, please note . If any field cannot be extracted, leave it as an empty string. Additionally, if the provided text is blank or does not appear to be an invoice, still return an JSON array with one object with all fields empty. Do not include any additional text or explanation in your response. 'A Customs Brokerage or A Customs Brokerage Inc' is always the buyer, so it should never be included as the vendor. There may be more than one invoice in the document. Only if you consider there is more than one invoice, add new elements to the JSON. If you consider there isn't enough data, such as the total and invoice number, leave the JSON with a single element. Please note that for a document to be declared as an invoice, it must at least have an Invoice Number, and that the Reference Number is not the same as the Invoice Number."
          },
          {
            role: "user",
            content: text
          }
        ]
      })
    });
    const chatData = await chatResponse.json();
    if (chatData.error) {
      return res.status(500).json({ error: chatData.error.message });
    }
    const result = chatData.choices[0].message.content;
    res.json({ response: result });
  } catch (error) {
    console.error("Error calling ChatGPT API:", error);
    res.status(500).json({ error: "Error calling ChatGPT API." });
  }
});



// Insert SQL Request
app.post("/insert", authMiddleware, async (req, res) => {
  // <<< OBTENER EL UserID DEL TOKEN >>>
  const { CompanyID, UserID } = req.user; // Asumiendo que el ID del usuario se llama 'ID' en el token

  try {
    const pool = await testConnection();
    const { docName, timestampName, vendor, referenceNumber, invoiceNumber, invoiceStatus, vendorAddress, invoiceDate, dueDate, fileURL, fileType, invoiceTotal } = req.body;

    // --- PASO 1: Insertar la factura en la tabla principal ---
    const result = await pool.request()
      .input('docName', sql.NVarChar(255), docName)
      .input('timestampName', sql.NVarChar(255), timestampName)
      .input('vendor', sql.NVarChar(255), vendor)
      .input('referenceNumber', sql.NVarChar(100), referenceNumber)
      .input('invoiceNumber', sql.NVarChar(100), invoiceNumber)
      .input('invoiceStatus', sql.Int, invoiceStatus)
      .input('vendorAddress', sql.NVarChar(255), vendorAddress)
      .input('invoiceDate', sql.NVarChar(50), invoiceDate)
      .input('dueDate', sql.NVarChar(50), dueDate)
      .input('checknumber', sql.NVarChar(50), '')
      .input('fileURL', sql.NVarChar(255), fileURL)
      .input('fileType', sql.NVarChar(50), fileType)
      .input('invoiceTotal', sql.NVarChar(50), invoiceTotal)
      .input('CompanyID', sql.Int, CompanyID)
      .query(`
        INSERT INTO Invoices 
          (docName, timestampName, vendor, referenceNumber, invoiceNumber, invoiceStatus, vendorAddress, invoiceDate, dueDate, fileURL, fileType, invoiceTotal, checknumber, CompanyID)
        OUTPUT INSERTED.ID insertedId
        VALUES 
          (@docName, @timestampName, @vendor, @referenceNumber, @invoiceNumber, @invoiceStatus, @vendorAddress, @invoiceDate, @dueDate, @fileURL, @fileType, @invoiceTotal, @checknumber, @CompanyID)
      `);
    
    // <<< CAPTURAR EL ID DE LA FACTURA RECIÉN CREADA >>>
    const newInvoiceId = result.recordset[0].insertedId;
    console.log(`ID de la factura insertada${newInvoiceId}`);
    // --- PASO 2: Insertar el primer estado en el historial ---
    await pool.request()
      .input('InvoiceID', sql.Int, newInvoiceId)
      // Asumiendo que '1' es el ID para el estado 'InProgress'
      .input('StatusID', sql.Int, 1) 
      .input('UserID', sql.Int, UserID)
      .query(`
        INSERT INTO InvoiceStatusHistory (InvoiceID, StatusID, UserID)
        VALUES (@InvoiceID, @StatusID, @UserID)
      `);

    res.json({ message: "Registro insertado exitosamente", invoiceId: newInvoiceId });

  } catch (error) {
    console.error("Error al insertar registro:", error);
    res.status(500).json({ error: "Error al insertar registro" });
  }
});

// Insert SQL Request
app.post("/insertDocumentIntoDatabase", authMiddleware, async (req, res) => {
  // <<< OBTENER UserID Y CompanyID DEL TOKEN >>>
  const { CompanyID, UserID } = req.user; 

  try {
    const pool = await testConnection();
    const { docName, timestampName, fileURL, fileType } = req.body;

    // --- PASO 1: Insertar el documento/factura en la tabla principal ---
    const result = await pool.request()
      .input('docName', sql.NVarChar(255), docName)
      .input('timestampName', sql.NVarChar(255), timestampName)
      .input('fileURL', sql.NVarChar(255), fileURL)
      .input('fileType', sql.NVarChar(50), fileType)
      .input('vendor', sql.NVarChar(255), 'Unknown Vendor')
      .input('invoiceNumber', sql.NVarChar(100), '')          // Valor vacío
      .input('referenceNumber', sql.NVarChar(100), '')     // Valor vacío
      .input('checknumber', sql.NVarChar(50), '')
      .input('invoiceTotal', sql.NVarChar(50), '')           // Valor vacío
      .input('invoiceDate', sql.NVarChar(50), '')            // Valor vacío
      .input('dueDate', sql.NVarChar(50), '')              // Valor vacío
      .input('CompanyID', sql.Int, CompanyID)
      .query(`
        INSERT INTO Invoices 
          (docName, timestampName, invoiceStatus, fileURL, fileType, vendor, referenceNumber, invoiceTotal, invoiceDate, dueDate, invoiceNumber, checknumber, CompanyID)
        OUTPUT INSERTED.ID -- Devuelve el ID de la fila insertada
        VALUES 
          (@docName, @timestampName, 1, @fileURL, @fileType, @vendor, @referenceNumber, @invoiceTotal, @invoiceDate, @dueDate, @invoiceNumber, @checknumber, @CompanyID)
      `);

    // <<< CAPTURAR EL ID DE LA FACTURA RECIÉN CREADA >>>
    const newInvoiceId = result.recordset[0].ID;

    // --- PASO 2: Insertar el primer estado ('InProgress') en el historial ---
    await pool.request()
      .input('InvoiceID', sql.Int, newInvoiceId)
      .input('StatusID', sql.Int, 1) // El estado inicial es 1 (InProgress)
      .input('UserID', sql.Int, UserID)
      .query(`
        INSERT INTO InvoiceStatusHistory (InvoiceID, StatusID, UserID)
        VALUES (@InvoiceID, @StatusID, @UserID)
      `);

    res.json({ message: "Registro insertado exitosamente", ID: newInvoiceId });

  } catch (error) {
    console.error("Error al insertar registro:", error);
    res.status(500).json({ error: "Error al insertar registro" });
  }
});


// Insert SQL Request
/* app.post("/company/insert/:CompanyName", async (req, res) => {
  try {
    const { CompanyName } = req.params;
    const pool = await testConnection();
    const result = await pool.request()
      .input('CompanyName', sql.NVarChar(255), CompanyName)
      .query(`
        INSERT INTO Company 
          (CompanyName)
        OUTPUT INSERTED.CompanyID insertedId
        VALUES 
          (@CompanyName)
      `);

    res.json({ message: "Registro insertado exitosamente", invoiceId: result.recordset[0].insertedId });
  } catch (error) {
    console.error("Error al insertar registro:", error);
    res.status(500).json({ error: "Error al insertar registro" });
  }
}); */

// Insert Update Notes Request
app.post("/notes-upsert", authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID; // viene del token
  try {
    const pool = await testConnection();
    const { invoiceID, content, userID } = req.body;
    const idsArray = Array.isArray(invoiceID) ? invoiceID : [invoiceID];

    const query = `
      MERGE INTO Notes AS target
      USING (
          SELECT i.ID AS invoiceID
          FROM Invoices i
          WHERE i.ID = @invoiceID AND i.CompanyID = @CompanyID
      ) AS source
      ON target.invoiceID = source.invoiceID
      WHEN MATCHED THEN
        UPDATE SET content = @content
      WHEN NOT MATCHED THEN
        INSERT (invoiceID, content, userID)
        VALUES (@invoiceID, @content, @userID);

    `;
    for (const id of idsArray) {
      await pool.request()
        .input('invoiceID', sql.Int, id)
        .input('content', sql.NVarChar(sql.MAX), content)
        .input('userID', sql.Int, userID)
        .input('CompanyID', sql.Int, CompanyID)
        .query(query);
    }

    res.json({ mensaje: "Notas actualizadas/insertadas correctamente" });
  } catch (error) {
    console.error("Error al insertar o actualizar la nota:", error);
    res.status(500).json({ error: "Error al insertar o actualizar la nota" });
  }
});


//Get Notes Request
app.get('/invoices/notes/:ID', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID;
  try {
    const { ID } = req.params;
    const pool = await testConnection();
    const result = await pool.request()
      .input('ID', sql.Int, ID)
      .input('CompanyID', sql.Int, CompanyID)
      .query("SELECT n.* FROM Notes n INNER JOIN Invoices i ON n.invoiceID = i.ID WHERE n.invoiceID = @ID AND i.CompanyID = @CompanyID;"); // Usar invoiceID para la relación
    res.json(result.recordset);
  } catch (error) {
    console.error("Error al obtener las notas:", error);
    res.status(500).json({ error: "Error al obtener las notas" });
  }
});


//Get Companies for the dropdown in send invitation (Admin panel)
app.get('/companies', authMiddleware, authorizeRole(1), async (req, res) => {
  try {
    const pool = await testConnection();
    const result = await pool.request()
      .query("select * from Company"); // Usar invoiceID para la relación
    res.json(result.recordset);
  } catch (error) {
    console.error("Error al obtener las compañias:", error);
    res.status(500).json({ error: "Error al obtener las compañias" });
  }
});

//Get Duplicated Invoices by InvoiceNumber
//Get Duplicated Invoices by InvoiceNumber
app.post('/getDuplicatedByInvoiceNumber', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID; // viene del token
  try {
    // --- CAMBIO 1: Recibe 'invoiceNumber' y 'vendor' del body ---
    const { invoiceNumber, vendor } = req.body;

    const pool = await testConnection();
    const result = await pool.request()
      // --- CAMBIO 2: Define los inputs con los nombres correctos ---
      .input('InvoiceNumber', sql.NVarChar(100), invoiceNumber)
      .input('Vendor', sql.NVarChar(255), vendor) // <-- Se añadió el input para el vendor
      .input('CompanyID', sql.Int, CompanyID)
      .query(`SELECT *
                    FROM Invoices
                    WHERE
                        invoiceStatus IN (1, 2, 3, 4)
                        AND invoiceNumber = @InvoiceNumber
                        AND vendor = @Vendor
                        AND CompanyID = @CompanyID
                        AND NOT (invoiceStatus = 4 AND LastModified >= DATEADD(day, -7, GETDATE()));`);

    res.json(result.recordset);

  } catch (error) {
    console.error("Error al obtener las facturas:", error);
    res.status(500).json({ error: "Error al obtener las facturas" });
  }
});

app.get('/getDuplicatedInvoices', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID; // viene del token
  try {
    const pool = await testConnection();
    const result = await pool.request()
      .input('CompanyID', sql.Int, CompanyID)
      .query(`
        SELECT
            TRIM(UPPER(vendor)) AS vendor,
            TRIM(UPPER(invoiceNumber)) AS invoiceNumber,
            COUNT(*) AS occurrences
        FROM
            Invoices
        WHERE
            invoiceStatus IN (1, 2, 3, 4)
            AND TRIM(invoiceNumber) <> ''
            AND CompanyID = @CompanyID
            AND NOT (invoiceStatus = 4 and LastModified < DATEADD(day, -7, GETDATE()))
        GROUP BY
            TRIM(UPPER(vendor)),
            TRIM(UPPER(invoiceNumber))
        HAVING
            COUNT(*) > 1;
      `);
    console.log(result);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error al obtener los invoices:", error);
    res.status(500).json({ error: "Error al obtener los invoices" });
  }
});


app.get('/invoices/status/:invoiceStatus', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID;

  try {
    const { invoiceStatus } = req.params;
    const { vendor, invoiceNumber, invoiceDate } = req.query;

    const pool = await testConnection();
    const request = pool.request();

    // --- INICIO DE LA LÓGICA CORREGIDA ---

    // 1. Empezamos con la consulta base, que siempre se aplicará.
    let query = `SELECT
                      I.*, 
                      N.content  
                  FROM
                      Invoices AS I 
                  LEFT JOIN
                      Notes AS N ON I.ID = N.invoiceID 
                  WHERE
                      I.CompanyID = @CompanyID AND I.invoiceStatus = @invoiceStatus`;

    // 2. Añadimos el filtro de fecha SOLO si el estado es 4.
    //    Usamos parseInt para asegurar que la comparación sea numérica.
    if (parseInt(invoiceStatus, 10) === 4) {
      query += ` AND LastModified >= DATEADD(day, -7, GETDATE())`;
    }

    // 3. Añadimos los filtros opcionales.
    if (vendor && vendor.trim() !== "") {
      query += " AND vendor LIKE @vendor";
      request.input('vendor', sql.VarChar, `%${vendor}%`);
    }
    if (invoiceNumber && invoiceNumber.trim() !== "") {
      query += " AND invoiceNumber LIKE @invoiceNumber";
      request.input('invoiceNumber', sql.VarChar, `%${invoiceNumber}%`);
    }
    if (invoiceDate && invoiceDate.trim() !== "") {
      query += " AND CAST(invoiceDate AS DATE) = @invoiceDate"; // Usamos CAST para comparar solo la fecha
      request.input('invoiceDate', sql.Date, invoiceDate);
    }

    // --- FIN DE LA LÓGICA CORREGIDA ---

    // Asignar los parámetros que siempre están presentes
    request.input('invoiceStatus', sql.Int, invoiceStatus);
    request.input('CompanyID', sql.Int, CompanyID);

    const result = await request.query(query);
    res.json(result.recordset);

  } catch (error) {
    console.error("Error al obtener los invoices:", error);
    res.status(500).json({ error: "Error al obtener los invoices" });
  }
});

/*
app.get('/invoices/status/:invoiceStatus', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID; // viene del token
  try {
    const pool = await testConnection();
    const result = await pool.request()
      .input('CompanyID', sql.Int, CompanyID)
      .query(`
        SELECT invoiceNumber, COUNT(*) AS occurrences
        FROM Invoices
        WHERE invoiceStatus IN (1, 2, 3, 4) AND invoiceNumber <> '' AND CompanyID = @CompanyID
        GROUP BY invoiceNumber
        HAVING COUNT(*) > 1;
      `);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error al obtener los invoices:", error);
    res.status(500).json({ error: "Error al obtener los invoices" });
  }
});
*/


// Get Duplicated Invoices SQL Request
app.get('/getCheckNumber', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID;
  try {
    const pool = await testConnection();

    // Ejecuta la consulta para obtener los invoiceNumber duplicados
    const result = await pool.request()
      .input('CompanyID', sql.Int, CompanyID)
      .query(`
        select top 1 * from checks_db WHERE CompanyID = @CompanyID order by ID DESC
      `);
    // Enviar el primer registro (o null si no hay resultados)
    const record = result.recordset.length > 0 ? result.recordset[0] : null;
    res.json(record);
  } catch (error) {
    console.error("Error al obtener los invoices:", error);
    res.status(500).json({ error: "Error al obtener los invoices" });
  }
});


// Edit vendors
app.put('/editVendors', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID;
  try {
    const { idsToEdit, valor } = req.body;

    if (!idsToEdit) {
      return res.status(400).json({ error: "No se proporcionó ningún ID" });
    }
    if (!valor) {
      return res.status(400).json({ error: "No se proporcionó ningún valor" });
    }

    const idsArray = Array.isArray(idsToEdit) ? idsToEdit : [idsToEdit];
    const pool = await testConnection();

    // Actualización en lote (opcional, ver comentario anterior)
    const idsParam = idsArray.join(',');
    await pool.request()
      .input('valor', sql.VarChar, valor)
      .input('CompanyID', sql.Int, CompanyID)
      .query(`UPDATE Invoices SET vendor = @valor WHERE ID IN (${idsParam})  AND CompanyID = @CompanyID`);

    res.status(200).json({ success: true, updated: idsArray.length });
  } catch (error) {
    console.error("Error editando vendors:", error);
    res.status(500).json({ error: "Error editando vendors" });
  }
});

//Edit check number on PAID screen
app.put('/editCheckNumberOnPaid', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID;
  try {
    const { idsToEdit, valor } = req.body;

    // Validaciones
    if (!idsToEdit) {
      return res.status(400).json({ error: "No se proporcionó ningún ID" });
    }
    if (!valor) {
      return res.status(400).json({ error: "No se proporcionó ningún valor" });
    }

    // Validar que valor sea un número entero positivo
    const numero = Number(valor);
    if (isNaN(numero) || !Number.isInteger(numero) || numero <= 0) {
      return res.status(400).json({ error: "El valor debe ser un número entero positivo" });
    }

    const idsArray = Array.isArray(idsToEdit) ? idsToEdit : [idsToEdit];
    const pool = await testConnection();


    try {
      // Actualizar las facturas
      const idsParam = idsArray.join(',');
      await pool.request()
        .input('valor', sql.VarChar, valor)
        .input('CompanyID', sql.Int, CompanyID)
        .query(`UPDATE Invoices SET checknumber = @valor WHERE ID IN (${idsParam}) AND CompanyID = @CompanyID`);

      // Actualizar el número de cheque en checks_db
      await pool.request()
        .input('valor', sql.Int, numero) // Usar Int para el número
        .input('CompanyID', sql.Int, CompanyID)
        .query(`
          IF EXISTS (SELECT 1 FROM checks_db WHERE CompanyID = @CompanyID)
              UPDATE checks_db 
              SET check_number = @valor 
              WHERE CompanyID = @CompanyID;
          ELSE
              INSERT INTO checks_db (check_number, CompanyID) 
              VALUES (@valor, @CompanyID);
        `);

      res.status(200).json({ success: true, updated: idsArray.length });
    } catch (error) {
      // Revertir la transacción en caso de error
      await transaction.rollback();
      console.error("Error en la transacción:", error);
      res.status(500).json({ error: "Error editando check numbers" });
    }
  } catch (error) {
    console.error("Error editando check numbers:", error);
    res.status(500).json({ error: "Error editando check numbers" });
  }
});


// Edit Status to Paid and add check number
app.put('/editCheckNumber', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID;
  try {
    const { idsToEdit, valor } = req.body;

    if (!idsToEdit) {
      return res.status(400).json({ error: "No se proporcionó ningún ID" });
    }
    if (!valor) {
      return res.status(400).json({ error: "No se proporcionó ningún valor" });
    }

    const idsArray = Array.isArray(idsToEdit) ? idsToEdit : [idsToEdit];
    const pool = await testConnection();

    // Actualización en lote para Invoices
    const idsParam = idsArray.join(',');
    await pool.request()
      .input('valor', sql.VarChar, valor)
      .input('CompanyID', sql.Int, CompanyID)
      .query(`UPDATE Invoices SET checknumber = @valor, invoiceStatus = 4 WHERE ID IN (${idsParam}) AND CompanyID = @CompanyID`);

    // Bucle para insertar en el historial
    /*
    for (const id of idsArray) {
      await pool.request()
        .input('invoiceID', sql.Int, id)
        .input('statusID', sql.Int, 4)
        .query('INSERT INTO InvoiceStatusHistory (InvoiceID, StatusID) VALUES (@invoiceID, @statusID)');
    }*/

    // Verificar si existen registros en checks_db
    const checkDbResult = await pool.request()
      .input('CompanyID', sql.Int, CompanyID)
      .query(`SELECT COUNT(*) AS RecordCount FROM checks_db WHERE CompanyID = @CompanyID`);
    const recordCount = checkDbResult.recordset[0].RecordCount;

    if (recordCount > 0) {
      // Actualizar todos los registros en checks_db
      await pool.request()
        .input('valor', sql.VarChar, valor)
        .input('CompanyID', sql.Int, CompanyID)
        .query(`UPDATE checks_db SET check_number = @valor WHERE CompanyID = @CompanyID`);
    } else {
      // Insertar un nuevo registro en checks_db
      await pool.request()
        .input('valor', sql.VarChar, valor)
        .input('CompanyID', sql.Int, CompanyID)
        .query(`INSERT INTO checks_db (check_number, CompanyID) VALUES (@valor, @CompanyID);`); // Ajusta los nombres de las columnas según tu tabla
    }

    res.status(200).json({ success: true, updated: idsArray.length });
  } catch (error) {
    console.error("Error editando:", error);
    res.status(500).json({ error: "Error editando" });
  }
});


// Remove Invoices
app.delete('/invoices', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID;
  try {
    const { ids } = req.body;
    if (!ids) {
      return res.status(400).json({ error: "No se proporcionó ningún ID" });
    }
    const idsArray = Array.isArray(ids) ? ids : [ids];
    const pool = await testConnection();

    for (const id of idsArray) {
      await pool.request()
        .input('id', sql.Int, id)
        .input('CompanyID', sql.Int, CompanyID)
        .query('DELETE FROM Invoices WHERE ID = @id AND CompanyID = @CompanyID');
    }

    res.json({ message: "Registros eliminados exitosamente" });
  } catch (error) {
    console.error("Error eliminando registros:", error);
    res.status(500).json({ error: "Error eliminando registros" });
  }
});

app.put('/invoices/update/:invoiceStatus', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID;
  try {
    const { invoiceStatus } = req.params;
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron IDs válidos' });
    }

    const pool = await testConnection();
    const idsList = ids.map(id => Number(id)).join(',');
    const query = `UPDATE Invoices SET invoiceStatus = @invoiceStatus WHERE ID IN (${idsList}) AND CompanyID = @CompanyID`;

    await pool.request()
      .input('invoiceStatus', sql.Int, invoiceStatus)
      .input('CompanyID', sql.Int, CompanyID)
      .query(query);

    // Bucle para insertar en el historial
    /*for (const id of ids) {
      await pool.request()
        .input('invoiceID', sql.Int, id)
        .input('statusID', sql.Int, invoiceStatus)
        .query('INSERT INTO InvoiceStatusHistory (InvoiceID, StatusID) VALUES (@invoiceID, @statusID)');
    }*/

    res.json({ message: "Registros actualizados correctamente" });
  } catch (error) {
    console.error("Error al actualizar registros:", error);
    res.status(500).json({ error: "Error al actualizar registros" });
  }
});

// Update Invoice
app.put('/invoices/:id', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID;
  try {
    const { id } = req.params;
    const { field, value } = req.body;
    const allowedFields = ['docName', 'invoiceNumber', 'referenceNumber', 'vendor', 'invoiceTotal', 'invoiceDate', 'dueDate'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({ error: "Campo no permitido" });
    }
    const pool = await testConnection();
    const query = `UPDATE Invoices SET ${field} = @value WHERE ID = @id AND CompanyID = @CompanyID`;
    await pool.request()
      .input('value', sql.NVarChar, value)
      .input('id', sql.Int, id)
      .input('CompanyID', sql.Int, CompanyID)
      .query(query);
    res.json({ message: "Registro actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar registro:", error);
    res.status(500).json({ error: "Error al actualizar registro" });
  }
});

//Primera actualizacion despues de subir el documento e ingresar primeros datos a la base de datos
app.put('/invoiceFirstUpdate', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID;
  try {
    const pool = await testConnection();
    const { invoiceID, vendor, referenceNumber, invoiceNumber, vendorAddress, invoiceDate, dueDate, invoiceTotal } = req.body;

    const result = await pool.request()
      .input('vendor', sql.NVarChar(255), vendor)
      .input('referenceNumber', sql.NVarChar(100), referenceNumber)
      .input('invoiceNumber', sql.NVarChar(100), invoiceNumber)
      .input('vendorAddress', sql.NVarChar(255), vendorAddress)
      .input('invoiceDate', sql.NVarChar(50), invoiceDate)
      .input('dueDate', sql.NVarChar(50), dueDate)
      .input('checknumber', sql.NVarChar(50), '')
      .input('invoiceTotal', sql.NVarChar(50), invoiceTotal)
      .input('invoiceID', sql.Int, invoiceID)
      .input('CompanyID', sql.Int, CompanyID)
      .query(`
    UPDATE Invoices
    SET vendor = @vendor,
        referenceNumber = @referenceNumber,
        invoiceNumber = @invoiceNumber,
        vendorAddress = @vendorAddress,
        invoiceDate = @invoiceDate,
        dueDate = @dueDate,
        invoiceTotal = @invoiceTotal,
        checknumber = @checknumber
    WHERE ID = @invoiceID AND CompanyID = @CompanyID
  `);


    // Se retorna el número de filas afectadas para confirmar la actualización
    res.json({ message: 'Factura actualizada exitosamente', rowsAffected: result.rowsAffected[0] });
  } catch (error) {
    console.error("Error al actualizar la factura:", error);
    res.status(500).json({ error: "Error al actualizar la factura" });
  }
});

app.post('/send-email', async (req, res) => {
  const { subject, invoices } = req.body;
  const to = EMAIL_TO;
  const attachments = invoices.map(({ url, docName }) => ({
    filename: docName,  // nombre con que aparecerá el adjunto
    path: generateSasUrlForBlob(url)           // la URL o ruta al archivo
  }));
  try {
    const info = await transporter.sendMail({
      from: `"AP" <${SMTP_USER}>`,
      to,         // puede ser un string o lista de correos
      subject,    // asunto
      attachments
    });

    console.log('Mensaje enviado: %s', info.messageId);
    res.json({ ok: true, messageId: info.messageId });
  } catch (error) {
    console.error('Error al enviar correo:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/saveInvitation', authMiddleware, authorizeRole(1), async (req, res) => {
  const { WorkEmail, CompanyID, RoleID } = req.body;
  try {
    const token = jwt.sign(
      { WorkEmail, CompanyID, RoleID },
      JWT_SECRET,
      { expiresIn: '5d' }
    );

    const pool = await testConnection();

    await pool.request()
      .input('WorkEmail', sql.NVarChar(255), WorkEmail)
      .input('CompanyID', sql.Int, CompanyID)
      .input('RoleID', sql.Int, RoleID)
      .input('Token', sql.NVarChar(255), token)
      .query(`
        INSERT INTO UserInvitation (WorkEmail, CompanyID, RoleID, Token, ExpiresAt)
        VALUES (@WorkEmail, @CompanyID, @RoleID, @Token, DATEADD(DAY, 5, GETDATE()))
      `);
    const emailResult = await sendInvitationEmail(WorkEmail, token);
    if (!emailResult.ok) {
      return res.status(500).json({ message: 'Invitación registrada pero falló el envío de correo', error: emailResult.error });
    }


    res.status(200).json({ message: 'Invitación registrada exitosamente', token });
  } catch (error) {
    console.error('Error al guardar la invitación:', error);
    res.status(500).json({ message: 'Error al registrar la invitación', error: error.message });
  }
});

app.post('/saveUser', verifyInvitationToken, async (req, res) => {
  const { FirstName, LastName, Password, Phone, Token } = req.body;
  const { CompanyID, RoleID, WorkEmail } = req.invite;

  try {
    // Procesar usuario
    const passwordHash = await bcrypt.hash(Password, 10);
    const pool = await testConnection();
    await pool.request()
      .input('FirstName', sql.NVarChar(100), FirstName)
      .input('LastName', sql.NVarChar(100), LastName)
      .input('WorkEmail', sql.NVarChar(255), WorkEmail)
      .input('Phone', sql.NVarChar(20), Phone || null)
      .input('PasswordHash', sql.NVarChar(255), passwordHash)
      .input('CompanyID', sql.Int, CompanyID)
      .input('RoleID', sql.Int, RoleID)
      .query(`
        INSERT INTO UserTable
          (FirstName, LastName, WorkEmail, Phone, PasswordHash, CompanyID, RoleID)
        VALUES
          (@FirstName, @LastName, @WorkEmail, @Phone, @PasswordHash, @CompanyID, @RoleID)
      `);

    // 3) (Opcional) Marcar invitación como usada
    await pool.request()
      .input('inviteToken', sql.NVarChar(255), Token)
      .query(`
        DELETE UserInvitation WHERE Token = @inviteToken
  `);

    // Devuelve JSON
    return res.status(200).json({ message: "Usuario guardado correctamente" });
  } catch (error) {
    console.error("Error al guardar el usuario:", error);
    return res.status(500).json({ error: "Error al guardar el usuario" });
  }
});

app.get('/getUsers', authMiddleware, authorizeRole(1), async (req, res) => {
  try {

    const pool = await testConnection();

    // Consulta base
    let query = `SELECT 
                    u.ID,
                    u.FirstName,
                    u.LastName,
                    u.WorkEmail,
                    u.Phone,
                    u.Active,
                    r.RoleName AS RoleName,
                    c.CompanyName AS CompanyName,
                    FORMAT(u.CreatedAt, 'MM/dd/yyyy') AS CreatedAt
                FROM 
                    UserTable u
                INNER JOIN 
                    Role r ON u.RoleID = r.ID
                INNER JOIN 
                    Company c ON u.CompanyID = c.ID;
                  `;

    // Preparar la request y asignar los parámetros
    const request = pool.request();

    const result = await request.query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error getting Users:", error);
    res.status(500).json({ error: "Error getting Users:" });
  }
});

app.put('/updateUserStatus', authMiddleware, authorizeRole(1), async (req, res) => {
  try {
    const { userId, active } = req.body;

    if (typeof userId !== 'number' || (active !== 0 && active !== 1)) {
      return res.status(400).json({ error: "Invalid input. 'userId' must be a number and 'active' must be 0 or 1." });
    }

    const pool = await testConnection();
    const request = pool.request();

    request.input('userId', userId);
    request.input('active', active); // 0 o 1 directamente

    const updateQuery = `
      UPDATE UserTable
      SET Active = @active
      WHERE ID = @userId
    `;

    const result = await request.query(updateQuery);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "User not found or no changes made." });
    }

    res.status(200).json({ message: "User status updated successfully." });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get('/getUserInvitations', authMiddleware, authorizeRole(1), async (req, res) => {
  try {
    const pool = await testConnection();

    const query = `
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
        `;

    const result = await pool.request().query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching invitations:", error);
    res.status(500).json({ error: "Failed to retrieve invitations" });
  }
});



app.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  console.log(password);
  if (!token || !password) {
    return res.status(400).json({ success: false, message: 'Token and password are required.' });
  }

  try {
    // 1. Verificar el JWT
    // jwt.verify lanzará un error si el token es inválido o ha expirado
    const decoded = jwt.verify(token, JWT_SECRET);
    const { userId } = decoded;

    // 2. Hashear la nueva contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. Actualizar la contraseña en la base de datos
    const pool = await testConnection();
    await pool.request()
      .input('hashedPassword', sql.NVarChar, hashedPassword)
      .input('userId', sql.Int, userId) // Asumiendo que el ID del usuario es de tipo Int
      .query('UPDATE UserTable SET PasswordHash = @hashedPassword WHERE ID = @userId');

    // Es importante usar un nombre de columna como 'PasswordHash' para no guardar contraseñas en texto plano.
    // Asegúrate que tu columna se llame así o ajústalo.

    // 4. Enviar respuesta de éxito
    res.status(200).json({ success: true, message: 'Password has been reset successfully.' });

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      // Si el error es por un token inválido o expirado
      return res.status(400).json({ success: false, message: 'This reset link is invalid or has expired.' });
    }

    // Para cualquier otro error (base de datos, etc.)
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, message: 'An error occurred on the server.' });
  }
});

async function sendInvitationEmail(WorkEmail, token) {
  const inviteLink = `http://${ROOT_DOMAIN}/complete-registration?token=${token}`;

  const body = `
    <h3 style="font-family: Arial, sans-serif; color: #333;">Welcome to PayGuard!</h3>
    <p style="font-family: Arial, sans-serif; color: #555;">You've been invited to create an account for our accounts payable system.</p>
    <p style="font-family: Arial, sans-serif; color: #555;">To get started, please click the link below to complete your registration:</p>
    <p style="margin: 20px 0;">
        <a href="${inviteLink}" style="background-color: #5A67D8; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-family: Arial, sans-serif;">Complete Your Registration</a>
    </p>
    <p style="font-family: Arial, sans-serif; color: #777; font-size: 12px;">Please note: For your security, this link will expire in 5 days.</p>
    <p style="font-family: Arial, sans-serif; color: #777; font-size: 12px;">If you did not expect this invitation, you can safely ignore this email.</p>
`;

  try {
    const info = await transporter.sendMail({
      from: `"PayGuard" <${SMTP_USER}>`,
      to: WorkEmail, // destinatario
      subject: "You're invited to join PayGuard!",
      html: body,
      // attachments: [...], // Opcional si necesitas adjuntar archivos
    });

    console.log('Mensaje enviado: %s', info.messageId);
    return { ok: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error al enviar correo:', error);
    return { ok: false, error: error.message };
  }
}

// ELIMINA O COMENTA ESTA RUTA - YA NO ES NECESARIA Y ES INSEGURA
/*
app.post('/checkEmailExists', async (req, res) => {
  // ...
});
*/

// MODIFICA ESTA RUTA PARA EL NUEVO FLUJO
app.post('/requestPasswordReset', async (req, res) => {
  const { email } = req.body;

  // La validación básica sigue siendo importante
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    const pool = await testConnection();
    const result = await pool
      .request()
      .input('email', sql.NVarChar, email)
      .query('SELECT ID FROM UserTable WHERE WorkEmail = @email');

    // *** LÓGICA CLAVE ***
    // Si el usuario existe en la base de datos...
    if (result.recordset.length > 0) {
      const userId = result.recordset[0].ID;

      // ...procede a crear el token y enviar el correo como antes.
      const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '10m' });
      const resetUrl = `http://${ROOT_DOMAIN}/reset-password?token=${token}`;
      const body = `
          <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
              <h3 style="color: #333;">Password Reset Request</h3>
              <p>We received a request to reset the password for your PayGuard account.</p>
              <p>If you made this request, please click the button below to set a new password. If you didn't, you can safely ignore this email.</p>
              <p style="margin: 30px 0;">
                  <a href="${resetUrl}" style="background-color: #5A67D8; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Your Password</a>
              </p>
              <p style="color: #777; font-size: 12px;">For your security, this link is only valid for 1 hour.</p>
          </div>
      `;
      await transporter.sendMail({
        from: `"PayGuard" <${SMTP_USER}>`,
        to: email,
        subject: "Reset Your PayGuard Password",
        html: body
      });
      console.log(`Reset email sent for existing user: ${email}`);
    } else {
      // Si el usuario NO existe, no hagas nada. Simplemente registra en el servidor para debugging.
      console.log(`Password reset requested for non-existing email: ${email}. No action taken.`);
    }

    // *** RESPUESTA CLAVE ***
    // Envía la misma respuesta exitosa en AMBOS casos (exista o no el email).
    return res.status(200).json({ success: true, message: 'Request processed.' });

  } catch (error) {
    // Solo si hay un error real del servidor (ej. la base de datos se cayó), envía un error 500.
    console.error('Error during password reset request:', error);
    return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});

// Middleware de autenticación
function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.redirect("/login");

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.redirect("/login");
  }
}

function authorizeRole(requiredRole) {
  return (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).send("You need a token!");
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.Role !== requiredRole) {
        return res.status(403).send("Access denied!");
      }

      req.user = decoded; // Opcional: guardar datos del usuario en req
      next();
    } catch (error) {
      return res.status(401).send("Invalid token!");
    }
  };
}

function verifyInvitationToken(req, res, next) {
  const { Token } = req.body;
  if (!Token) return res.status(400).send("You need a token!");

  try {
    const decoded = jwt.verify(Token, JWT_SECRET);
    req.invite = decoded; // Puedes guardar los datos decodificados si los necesitas
    next();
  } catch (err) {
    return res.status(403).send("Invalid token!");
  }
}



// Login
app.post('/auth', async (req, res) => {
  try {
    const { email, password } = req.body;

    const pool = await testConnection();

    const query = `
      SELECT ID, FirstName, WorkEmail, PasswordHash, CompanyID, RoleID
      FROM UserTable
      WHERE WorkEmail = @email and Active = 1
    `;

    const request = pool.request();
    request.input('email', sql.NVarChar(100), email);

    const result = await request.query(query);

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: "Invalid Credentials!" });

    }

    const user = result.recordset[0];

    const isPasswordValid = await bcrypt.compare(password, user.PasswordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid Credentials!" });
    }

    // Generar el JWT con userId y CompanyID
    const token = jwt.sign(
      { UserID: user.ID, CompanyID: user.CompanyID, Role: user.RoleID },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Enviar token y datos básicos del usuario
    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // Solo con HTTPS. Quita esto si estás en localhost sin HTTPS.
      sameSite: "Strict", // Protege contra CSRF
      maxAge: 28800000, // 1 hora
    });

    res.json({ message: "Login exitoso" });

  } catch (error) {
    console.error("Error en el login:", error);
    res.status(500).json({ error: "Error al intentar iniciar sesión" });
  }
});

app.get('/getCurrentUser', authMiddleware, (req, res) => {
  const token = req.cookies.token;

  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ role: decoded.Role, CompanyID: decoded.CompanyID });
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
});

async function urlToGenerativePart(url) {
  console.log(`Descargando archivo desde: ${url}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error al descargar el archivo: ${response.statusText}`);
  }

  // Obtener el buffer del archivo y el tipo MIME
  const buffer = await response.buffer();
  const mimeType = response.headers.get('content-type');

  // Devolver el objeto en el formato que espera la API de Gemini
  return {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType,
    },
  };
}

function cleanResponse(responseText) {
  // Busca un bloque de código JSON y extrae su contenido.
  const match = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);

  // Si encuentra un bloque, devuelve el contenido limpio. Si no, devuelve el texto original.
  // Esto lo hace seguro: si la IA ya devuelve el JSON puro, no lo romperá.
  return match ? match[1].trim() : responseText.trim();
}

//CAll to Gemini 2.5 flash preview
// 4. Crear el endpoint de la API
app.post('/analyze-invoice', authMiddleware, async (req, res) => {
  // Obtener la URL del archivo desde los query parameters de la petición
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Falta el parámetro "url" en la consulta.' });
  }

  const sasUrl = generateSasUrlForBlob(url);

  try {
    // Paso 1: Convertir la URL al formato que necesita Gemini
    const imagePart = await urlToGenerativePart(sasUrl);

    // Paso 2: Definir el prompt con las instrucciones
    const prompt = `
        You are a specialized data extraction AI. Your sole function is to analyze the provided document file (PDF or PNG) and return a single, valid JSON object. Your response must contain only the raw JSON and no other text, explanations, or markdown formatting.

        The JSON object must conform to the following structure:

        JSON

        {
          "invoices": [
            {
              "vendor_name": "value",
              "reference_number": "value",
              "invoice_date": "value",
              "vendor_address": "value",
              "invoice_number": "value",
              "invoice_due_date": "value",
              "invoice_total": "value",
              "pages": "value"
            }
          ]
        }
        Adhere to these strict processing rules:

        Page Grouping: The document may contain multiple invoice "packages." An invoice package includes the primary invoice page and all subsequent pages that act as its backup or supporting documentation (e.g., receipts, proofs of delivery) until the next primary invoice page is detected. You must identify these distinct groups. For example, if a 10-page document contains an invoice on page 1 with backups on pages 2-5, and a second invoice on page 6 with backups on pages 7-10, you will create two objects in the invoices array. The first object will have "pages": "1-5" and the second will have "pages": "6-10".

        Multiple Invoices: If you identify multiple distinct invoice packages as described above, create a separate JSON object for each one within the invoices array.

        Data Formatting:
        Dates (invoice_date, invoice_due_date): Must be formatted as MM/DD/YYYY. Interpret various date formats from the document and convert them to this specific format.
        Total (invoice_total): Must be a string containing only numbers and a period . as the decimal separator. Remove all currency symbols (e.g., $) and thousand separators (e.g., ,). For example, "$1,300.54" must be returned as "1300.54".
        Pages (pages): Must always be a string representing a range in the format "start_page-end_page". If an invoice package is only a single page (e.g., page 1), it must be returned as "1-1". A multi-page invoice from page 2 to 4 would be "2-4".

        Field Extraction:
        If any field's value cannot be extracted, return it as an empty string "".
        reference_number: Extract any value labeled as "Reference Number," "File Number," "Manifest," or similar references.
        Exclusion Rule: The entity "A Customs Brokerage" (or its variations like "A Customs Brokerage Inc") is always the buyer. It must never be extracted as the vendor_name.

        Output Formatting Rule:
        - Your response MUST be a raw string containing only the JSON object.
        - The response MUST NOT contain any text, explanations, or introductions.
        - CRITICAL: DO NOT include the markdown fences \`\`\`json or \`\`\`. The response must begin with the character '{' and end with the character '}'.
    `;

    // Paso 3: Enviar la petición al modelo de Gemini
    console.log('Enviando petición a Gemini...');
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    console.log(cleanResponse(responseText));
    // Limpiar la respuesta para asegurar que sea un JSON válido
    const cleanedJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    // Paso 4: Devolver la respuesta JSON al cliente
    console.log('Respuesta recibida y enviada al cliente.');
    res.setHeader('Content-Type', 'application/json');
    res.send(cleanedJsonString);

  } catch (error) {
    console.error('Ha ocurrido un error:', error);
    res.status(500).json({ error: 'No se pudo procesar el archivo.', details: error.message });
  }
});


// Endpoint para obtener las métricas del dashboard
app.get('/dashboard-metrics', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID;
  console.log(CompanyID);
  const query = `
        SELECT 
            -- Tarjeta 1: Total a Pagar (Total Outstanding)
            (SELECT ISNULL(SUM(CAST(invoiceTotal AS MONEY)), 0) FROM Invoices WHERE invoiceStatus IN (1, 2, 3) AND CompanyID = @CompanyID) AS TotalOutstanding,

            -- Tarjeta 2: Facturas Pendientes (Pending Invoices)
            (SELECT COUNT(ID) FROM Invoices WHERE invoiceStatus IN (1, 2, 3) AND CompanyID = @CompanyID) AS PendingInvoices,

            -- Tarjeta 3: Pagado este Mes (Paid this Month)
            (SELECT ISNULL(SUM(CAST(invoiceTotal AS MONEY)), 0) FROM Invoices WHERE invoiceStatus = 4 AND MONTH(LastModified) = MONTH(GETDATE()) AND YEAR(LastModified) = YEAR(GETDATE()) AND CompanyID = @CompanyID) AS PaidThisMonth,

            -- Tarjeta 4: Facturas Atrasadas (Overdue Invoices)
            -- Corregido: Usamos TRY_CAST para evitar el error de conversión.
            (SELECT COUNT(ID) FROM Invoices WHERE invoiceStatus IN (1, 2, 3) AND TRY_CAST(dueDate AS DATE) < GETDATE() AND CompanyID = @CompanyID) AS OverdueInvoices;
    `;

  try {
    const pool = await testConnection();
    const result = await pool.request()
      .input('CompanyID', sql.Int, CompanyID)
      .query(query);

    const metrics = result.recordset.length > 0 ? result.recordset[0] : null;
    res.json(metrics);

  } catch (error) {
    console.error("Error al obtener las métricas del dashboard:", error);
    res.status(500).json({ error: "Error interno del servidor al obtener las métricas." });
  }
});

app.get('/invoices-processed-chart', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID;
  // Esta consulta cuenta las facturas que se consideran "terminadas" (pagadas o eliminadas)
  const query = `
        SELECT 
            FORMAT(LastModified, 'yyyy-MM') AS PaidMonth,
            COUNT(ID) AS NumberOfInvoices
        FROM 
            Invoices
        WHERE 
            invoiceStatus = 4 -- Se usa paréntesis para la lógica correcta
            AND YEAR(LastModified) = YEAR(GETDATE())
            AND CompanyID = @CompanyID
        GROUP BY 
            FORMAT(LastModified, 'yyyy-MM')
        ORDER BY 
            PaidMonth;
    `;

  try {
    const pool = await testConnection();
    const result = await pool.request()
      .input('CompanyID', sql.Int, CompanyID)
      .query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error al obtener los datos para el gráfico de facturas:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Endpoint para los datos del gráfico de pagos mensuales
app.get('/monthly-paid-chart', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID;
  // CORRECCIÓN: Esta consulta ahora solo suma las facturas con estado 4 (Paid) para precisión.
  const query = `
        SELECT 
            FORMAT(LastModified, 'yyyy-MM') AS PaymentMonth,
            SUM(CAST(invoiceTotal AS MONEY)) AS TotalPaid
        FROM 
            Invoices
        WHERE 
            invoiceStatus = 4
            AND YEAR(LastModified) = YEAR(GETDATE())
            AND CompanyID = @CompanyID
        GROUP BY 
            FORMAT(LastModified, 'yyyy-MM')
        ORDER BY 
            PaymentMonth;
    `;

  try {
    const pool = await testConnection();
    const result = await pool.request()
      .input('CompanyID', sql.Int, CompanyID)
      .query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error("Error al obtener los datos para el gráfico de pagos:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});


// 1. Promedio mensual del tiempo de procesamiento
app.get('/avg-processing-chart', authMiddleware, async (req, res) => {
  const CompanyID = req.user.CompanyID;

  const query = `
        SELECT 
            FORMAT(LastModified, 'yyyy-MM') AS PaidMonth,
            AVG(DATEDIFF(day, Timestamp, LastModified)) AS AvgProcessingDays
        FROM Invoices
        WHERE 
            invoiceStatus = 4
            AND YEAR(LastModified) = YEAR(GETDATE())
            AND CompanyID = @CompanyID
        GROUP BY FORMAT(LastModified, 'yyyy-MM')
        ORDER BY PaidMonth;
  `;

  try {
    const pool = await testConnection();
    const result = await pool.request()
      .input('CompanyID', sql.Int, CompanyID)
      .query(query);

    res.json(result.recordset);
  } catch (error) {
    console.error("Error obteniendo Avg Processing mensual:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});


//Top 5 vendors by spend last 3 months
app.get('/top-vendors-chart', authMiddleware, async (req, res) => {
    // Obtenemos el CompanyID del usuario que está logueado
    const { CompanyID } = req.user;

    const query = `
        SELECT TOP 5
            vendor,
            SUM(CAST(invoiceTotal AS DECIMAL(18, 2))) AS TotalSpend
        FROM
            Invoices
        WHERE
            invoiceStatus = 4
            AND CompanyID = @CompanyID
            AND LastModified >= DATEADD(month, -3, GETDATE())
        GROUP BY
            vendor
        ORDER BY
            TotalSpend DESC;
    `;

    try {
        const pool = await testConnection();
        const result = await pool.request()
            .input('CompanyID', sql.Int, CompanyID) // Pasamos el CompanyID de forma segura
            .query(query);

        // Enviamos los resultados como JSON
        res.json(result.recordset);
    } catch (error) {
        console.error("Error obteniendo el top 5 de proveedores:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
});

// Servir archivos estáticos (para ver los archivos subidos)
app.use("/uploads", authMiddleware, express.static(uploadDir));

// Servir el index.html como homepage
app.get("/", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/dashboard", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

app.get("/waiting-approval", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "waiting-approval.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logout exitoso" });
});


app.get("/forgot-password", (req, res) => {
  res.sendFile(path.join(__dirname, "forgot-password.html"));
});

app.get("/complete-registration", (req, res) => {
  res.sendFile(path.join(__dirname, "complete-registration.html"));
});

app.get("/reset-password", (req, res) => {
  res.sendFile(path.join(__dirname, "reset-password.html"));
});

app.get("/ready-to-pay", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "/ready-to-pay.html"));
});

app.get("/newindex", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "/newindex.html"));
});

app.get("/paid", authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, "/paid.html"));
});

app.get("/user-management", authMiddleware, authorizeRole(1), (req, res) => {
  res.sendFile(path.join(__dirname, "user-management.html"));
});

// Middleware para manejar 404
app.use((req, res, next) => {
  res.redirect('/login');  // redirige a la página de login si la ruta no existe
});

// Iniciar el servidor
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://${ROOT_DOMAIN}:${port}`);
});
