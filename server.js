const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const Tesseract = require("tesseract.js");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const fetch = require("node-fetch"); // Asegúrate de instalar node-fetch versión 2: npm install node-fetch@2
const sql = require('mssql');

require("dotenv").config();

const USER = process.env.USER;
const PASSWORD = process.env.PASSWORD;
const SERVER = process.env.SERVER;
const DATABASE = process.env.DATABASE;
const PORT = parseInt(process.env.PORT, 10);

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

//const { BlobServiceClient } = require("@azure/storage-blob");
//const { StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } = require("@azure/storage-blob");
const { BlobServiceClient, BlobClient, StorageSharedKeyCredential, BlobSASPermissions, generateBlobSASQueryParameters} = require('@azure/storage-blob');



const app = express();
const port = 3000;

// Configuración de CORS y parsers
app.use(cors());
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
app.post("/extract-text", async (req, res) => {
  let { filePath } = req.body;
  const sasUrl = generateSasUrlForBlob(filePath);
  if (!sasUrl) {
    return res.status(400).json({ error: "No se proporcionó la URL del archivo." });
  }

  // Validar que filePath sea una URL
  if (!sasUrl.startsWith("http")) {
    return res.status(400).json({ error: "El filePath debe ser una URL." });
  }

  try {
    const response = await fetch(sasUrl);
    if (!response.ok) {
      return res.status(500).json({ error: "Error al descargar el archivo desde la URL." });
    }
    const buffer = await response.buffer();

    const ext = path.extname(new URL(sasUrl).pathname).toLowerCase();
    let extractedText = "";

    if (ext === ".pdf") {
      const data = await pdfParse(buffer);
      extractedText = data.text;
    } else if ([".png", ".jpg", ".jpeg", ".bmp", ".tiff"].includes(ext)) {
      const { data: { text } } = await Tesseract.recognize(buffer, "eng");
      extractedText = text;
    } else {
      return res.status(400).json({ error: "Tipo de archivo no soportado." });
    }

    return res.json({ text: extractedText });
  } catch (error) {
    console.error("Error al extraer texto del archivo desde la URL:", error);
    return res.status(500).json({ error: "Error al procesar el archivo." });
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
  // Se obtienen las credenciales desde variables de entorno
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

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
    expiresOn: new Date(now.getTime() + 60 * 60 * 1000) // válido por 1 hora
  };

  // Generar el SAS token
  const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();

  // Retornar la URL del blob con el SAS token concatenado
  return `${blobUrl}?${sasToken}`;
}

async function deleteFile(fileUrl){
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
        "Authorization": process.env.OPENAI_KEY
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are an assistant that extracts invoice information. Based on the following text, generate a JSON containing the following fields:\n\n- `vendor_name`\n- `invoice_date` (formatted as MM/DD/YYYY)\n- `vendor_address` \n- `invoice_number`\n- `invoice_due_date`(formatted as MM/DD/YYYY)\n- `invoice_total` (Formatted as a decimal number with the (.) as the decimal separator. Remove any other character except the (.) in the decimals, e.g., 3096,33)\n\nIf any of the fields cannot be filled, leave them as an empty string.\n\nImportant: The buyer (client) is always 'A Customs Brokerage' so this information should not be included in the JSON. And "
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.7
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
app.post("/insert", async (req, res) => {
  try {
    const pool = await testConnection();
    const { docName, timestampName, vendor, invoiceNumber, invoiceStatus, vendorAddress, invoiceDate, dueDate, fileURL, fileType, invoiceTotal } = req.body;

    const result = await pool.request()
      .input('docName', sql.NVarChar(255), docName)
      .input('timestampName', sql.NVarChar(255), timestampName)
      .input('vendor', sql.NVarChar(255), vendor)
      .input('invoiceNumber', sql.NVarChar(100), invoiceNumber)
      .input('invoiceStatus', sql.Int, invoiceStatus)
      .input('vendorAddress', sql.NVarChar(255), vendorAddress)
      .input('invoiceDate', sql.NVarChar(50), invoiceDate)
      .input('dueDate', sql.NVarChar(50), dueDate)
      .input('fileURL', sql.NVarChar(255), fileURL)
      .input('fileType', sql.NVarChar(50), fileType)
      .input('invoiceTotal', sql.NVarChar(50), invoiceTotal)
      .query(`
        INSERT INTO Invoices 
          (docName, timestampName, vendor, invoiceNumber, invoiceStatus, vendorAddress, invoiceDate, dueDate, fileURL, fileType, invoiceTotal)
        OUTPUT INSERTED.ID insertedId
        VALUES 
          (@docName, @timestampName, @vendor, @invoiceNumber, @invoiceStatus, @vendorAddress, @invoiceDate, @dueDate, @fileURL, @fileType, @invoiceTotal)
      `);

    res.json({ message: "Registro insertado exitosamente", invoiceId: result.recordset[0].insertedId });
  } catch (error) {
    console.error("Error al insertar registro:", error);
    res.status(500).json({ error: "Error al insertar registro" });
  }
});


// Insert SQL Request
app.post("/company/insert/:CompanyName", async (req, res) => {
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
});

// Insert Update Notes Request
app.post("/notes-upsert", async (req, res) => {
  try {
    const pool = await testConnection();
    const { invoiceID, content, userID } = req.body;
    const query = `
      MERGE INTO Notes AS target
      USING (SELECT @invoiceID AS invoiceID) AS source
      ON target.invoiceID = source.invoiceID
      WHEN MATCHED THEN
        UPDATE SET content = @content
      WHEN NOT MATCHED THEN
        INSERT (invoiceID, content, userID)
        VALUES (@invoiceID, @content, @userID);
    `;
    
    const result = await pool.request()
      .input('invoiceID', sql.Int, invoiceID)
      .input('content', sql.NVarChar(sql.MAX), content)
      .input('userID', sql.Int, userID)
      .query(query);

    // Después de la consulta:
      const responseData = result.recordset && result.recordset.length ? result.recordset : { mensaje: "Operación realizada correctamente" };
      res.json(responseData);
  } catch (error) {
    console.error("Error al insertar o actualizar la nota:", error);
    res.status(500).json({ error: "Error al insertar o actualizar la nota" });
  }
});


//Get Notes Request
app.get('/invoices/notes/:ID', async (req, res) => {
  try {
    const { ID } = req.params;
    const pool = await testConnection();
    const result = await pool.request()
      .input('ID', sql.Int, ID)
      .query("SELECT * FROM Notes WHERE invoiceID = @ID"); // Usar invoiceID para la relación
    res.json(result.recordset);
  } catch (error) {
    console.error("Error al obtener las notas:", error);
    res.status(500).json({ error: "Error al obtener las notas" });
  }
});




// Get Invoices SQL Request
app.get('/invoices/status/:invoiceStatus', async (req, res) => {
  try {
    const { invoiceStatus } = req.params;
    const pool = await testConnection();
    const result = await pool.request()
      .input('invoiceStatus', sql.Int, invoiceStatus)
      .query("SELECT * FROM Invoices WHERE invoiceStatus = @invoiceStatus");
    res.json(result.recordset);
  } catch (error) {
    console.error("Error al obtener los invoices:", error);
    res.status(500).json({ error: "Error al obtener los invoices" });
  }
});

// Remove Invoices
app.delete('/invoices', async (req, res) => {
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
        .query('DELETE FROM Invoices WHERE ID = @id');
    }

    res.json({ message: "Registros eliminados exitosamente" });
  } catch (error) {
    console.error("Error eliminando registros:", error);
    res.status(500).json({ error: "Error eliminando registros" });
  }
});

app.put('/invoices/update/:invoiceStatus', async (req, res) => {
  try {
    const { invoiceStatus } = req.params;
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron IDs válidos' });
    }
    
    const pool = await testConnection();
    const idsList = ids.map(id => Number(id)).join(',');
    const query = `UPDATE Invoices SET invoiceStatus = @invoiceStatus WHERE ID IN (${idsList})`;
    
    await pool.request()
      .input('invoiceStatus', sql.Int, invoiceStatus)
      .query(query);
    
    res.json({ message: "Registros actualizados correctamente" });
  } catch (error) {
    console.error("Error al actualizar registros:", error);
    res.status(500).json({ error: "Error al actualizar registros" });
  }
});

// Update Invoice
app.put('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { field, value } = req.body;
    const allowedFields = ['docName', 'invoiceNumber', 'vendor', 'invoiceTotal', 'invoiceDate', 'dueDate'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({ error: "Campo no permitido" });
    }
    const pool = await testConnection();
    const query = `UPDATE Invoices SET ${field} = @value WHERE ID = @id`;
    await pool.request()
      .input('value', sql.NVarChar, value)
      .input('id', sql.Int, id)
      .query(query);
    res.json({ message: "Registro actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar registro:", error);
    res.status(500).json({ error: "Error al actualizar registro" });
  }
});

// Servir archivos estáticos (para ver los archivos subidos)
app.use("/uploads", express.static(uploadDir));

// Servir el index.html como homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/waiting-approval", (req, res) => {
  res.sendFile(path.join(__dirname, "waiting-approval.html"));
});

app.get("/ready-to-pay", (req, res) => {
  res.sendFile(path.join(__dirname, "/ready-to-pay.html"));
});

app.get("/paid", (req, res) => {
  res.sendFile(path.join(__dirname, "/paid.html"));
});

// Middleware para manejar 404
app.use((req, res, next) => {
  res.status(404).send("Lo siento, no se pudo encontrar esa ruta.");
});

// Iniciar el servidor
app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
