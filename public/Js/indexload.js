
document.addEventListener('DOMContentLoaded', loadInvoices);


/*Subir documentos*/
const dropArea = document.getElementById("drop-area");
const tableBody = document.querySelector('tbody');
dropArea.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropArea.style.backgroundColor = "#e1e7ed";
});

dropArea.addEventListener("dragleave", () => {
  dropArea.style.backgroundColor = "#f9f9f9";
});

dropArea.addEventListener("drop", (event) => {
  event.preventDefault();
  dropArea.style.backgroundColor = "#f9f9f9";
  const files = event.dataTransfer.files;
  for (const file of files) {
    if (file.type === "application/pdf" || file.type === "image/png" || file.type === "image/jpeg") {
      showTemporaryRow();
      uploadFile(file);
    } else {
      alert("The file types allowed are PDF, PNG and JPG.");
    }
  }
});

// Función para llamar a la API de ChatGPT utilizando el JSON body proporcionado
async function callChatGPT(texto) {
  try {
    const response = await fetch("/chatgpt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: texto })
    });
    const data = await response.json();
    if (data.error) {
      console.error("Error en la respuesta del servidor:", data.error);
      throw new Error(data.error);
    }
    return data.response;
  } catch (error) {
    console.error("Error llamando al endpoint /chatgpt:", error);
    throw error;
  }
}

async function insertRecord(docName, timestampName, fileType, fileURL, chatGPTData) {
  try {
    const response = await fetch(`http://${window.miVariable}:3000/insert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        docName: docName,
        timestampName: timestampName,
        vendor: chatGPTData.vendor_name,
        referenceNumber: chatGPTData.reference_number,
        invoiceNumber: chatGPTData.invoice_number,
        invoiceStatus: 1,
        vendorAddress: chatGPTData.vendor_address,
        invoiceDate: chatGPTData.invoice_date,  // Asegúrate que sea el campo correcto
        dueDate: chatGPTData.invoice_due_date,
        fileURL: fileURL,
        fileType: fileType,
        invoiceTotal: chatGPTData.invoice_total
      })
    });

    const serverResponse = await response.json();
    return serverResponse.invoiceId;
  } catch (error) {
    console.error("Error en la inserción:", error);
    throw error;
  }
}
// Función para subir el archivo, extraer el texto y llamar a ChatGPT
async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  // Declaramos las variables fuera del try para tener acceso a ellas en el catch
  let data = null;
  let timestampName = null;
  let responseObject = null;
  let invoiceID = null;

  try {
    const uploadResponse = await fetch(`http://${window.miVariable}:3000/upload`, {
      method: "POST",
      body: formData,
    });
    data = await uploadResponse.json();
    timestampName = data.filename;
    console.log(data);

    invoiceID = await insertDocumentIntoDatabase(file.name, timestampName, file.type, data.url)

    // Obtenemos el texto extraído del archivo
    const operationn = await operationLocation(data.url); // Obtener el operationLocation
    const textoJson = await getExtractedTextPost(operationn); // Obtener el JSON con los datos
    const finalText = frmattingTexto(textoJson);

    // Llamamos a ChatGPT usando el texto extraído
    const chatGPTResponse = await callChatGPT(finalText);
    responseObject = extractJson(chatGPTResponse);
    console.log(responseObject);

    if (responseObject.invoices.length === 1) {
      await updateRecord(invoiceID, responseObject.invoices[0]);
    } else {
      // setup the pdf4meClient
      const url = data.url;
      const promises = responseObject.invoices.map(invoice => extractPages(url, invoice));
      await Promise.all(promises);
      eliminarBlobMultiInvoice(data.url);
      if (invoiceID) {
        await deleteInvoiceByID(invoiceID)
      }
    }
    loadInvoices();
  } catch (error) {
    console.error("Error en el proceso:", error);
    loadInvoices();
  }

}

async function updateRecord(invoiceID, invoice) {
  try {
    const response = await fetch(`http://${window.miVariable}:3000/invoiceFirstUpdate`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        invoiceID,
        vendor: invoice.vendor_name,
        referenceNumber: invoice.reference_number,
        invoiceNumber: invoice.invoice_number,
        vendorAddress: invoice.vendor_address,
        invoiceDate: invoice.invoice_date,  // Asegúrate que sea el campo correcto
        dueDate: invoice.invoice_due_date,
        invoiceTotal: invoice.invoice_total
      })
    });
  } catch (error) {
    alert(error);
    console.log("error al actualizar la factura", error);
  }
}

async function insertDocumentIntoDatabase(docName, timestampName, fileType, fileURL) {
  try {
    const response = await fetch(`http://${window.miVariable}:3000/insertDocumentIntoDatabase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        docName: docName,
        timestampName: timestampName,
        fileURL: fileURL,
        fileType: fileType
      })
    });

    // Procesamos la respuesta en formato JSON
    const data = await response.json();
    // Se asume que el servidor retorna el ID con el nombre "ID"
    const insertedID = data.ID;

    // Puedes retornar o utilizar el ID según lo necesites
    console.log(insertedID);
    return insertedID;
  } catch (error) {
    console.log(error);
    alert("Unable to insert the document at this time!");
  }
}




function convertirRango(rango) {
  // Separamos el string usando '-' y convertimos a números
  const [inicio, fin] = rango.split("-").map(num => parseInt(num, 10));

  // Creamos un arreglo para almacenar los números
  const numeros = [];
  for (let i = inicio; i <= fin; i++) {
    numeros.push(i);
  }

  // Retornamos el arreglo convertido a string separado por comas
  return numeros.join(",");
}

async function extractPages(url, invoice) {
  const range = convertirRango(invoice.pages);
  try {
    const response = await fetch(`http://${window.miVariable}:3000/extractpdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, range }),
    });

    if (!response.ok) {
      throw new Error("Error en la respuesta del servidor");
    }

    // Obtén el PDF extraído como un Blob
    const pdfBlob = await response.blob();

    // Crea un FormData para enviarlo al endpoint de upload
    const formData = new FormData();
    // El tercer parámetro es el nombre del archivo
    formData.append("file", pdfBlob, "extractedPdf.pdf");

    const uploadResponse = await fetch(`http://${window.miVariable}:3000/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await uploadResponse.json();
    const timestampName = data.filename;
    const id = await insertRecord(timestampName, timestampName, "application/pdf", data.url, invoice);
  } catch (error) {
    console.error("Error al extraer el pdf", error);
  }
}



function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/); // Busca el contenido entre el primer [ y el último ]
  console.log(match[0]);
  if (match) {
    try {
      return JSON.parse(match); // Intenta convertir el resultado a JSON
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return null;
    }
  }
  return null;
}

function frmattingTexto(textoJson) {
  const data = typeof textoJson === 'string' ? JSON.parse(textoJson) : textoJson;
  // Inicializar una variable para almacenar el texto extraído
  let extractedText = '';
  console.log(textoJson);
  console.log(data.length);
  // Recorrer solo las primeras 3 páginas
  data.forEach((page, index) => {
    if (index <= 30 && page.lines) {
      page.lines.forEach(line => {
        extractedText += line.text + '\n';
      });
      extractedText += "This is the end of page " + page.page + '\n';
    }
  });
  return extractedText;
}

async function operationLocation(url) {

  const filePath = url;
  try {
    const response = await fetch(`http://${window.miVariable}:3000/get-operationLocation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filePath }),
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(`Error: ${data.error}`);
    }
    return data.operationLocation;
  } catch (error) {
    console.error('Error al realizar la solicitud:', error);
    throw error;
  }
}

async function getExtractedTextPost(operationLocationUrl) {

  try {
    const response = await fetch(`http://${window.miVariable}:3000/extract-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operationLocation: operationLocationUrl })
    });
    const data = await response.json();
    console.log(data);
    if (data.error) {
      throw new Error(`Error: ${data.error}`);
    }
    return data.results;
  } catch (error) {
    console.error('Error al obtener el resultado:', error);
    throw error;
  }
}

function showTemporaryRow() {
  const tempRow = document.createElement("tr");
  tempRow.id = "tempRow"; // Asigna un ID para poder eliminarla luego
  // Suponiendo que la tabla tiene 9 columnas (ajusta colSpan si es necesario)
  const tempCell = document.createElement("td");
  tempCell.colSpan = 9;
  // Puedes incluir un spinner o icono de carga junto con un mensaje
  tempCell.innerHTML = `
    <div style="display: flex; align-items: center;">
      <div class="spinner" style="margin-right: 8px;"></div>
      Processing...
    </div>
  `;
  tempRow.appendChild(tempCell);
  tableBody.appendChild(tempRow);
}

function clearFilter() {
  // Restablecer los valores de los inputs del filtro
  document.getElementById('filter-vendor').value = '';
  document.getElementById('filter-invoiceNumber').value = '';
  document.getElementById('filter-invoiceDate').value = '';

  // Llamar a loadInvoices para recargar las facturas sin ningún filtro aplicado
  loadInvoices();
}

//Cargar elementos pending to review de la base de datos
async function loadInvoices() {
  try {
    const vendor = document.getElementById('filter-vendor').value;
    const invoiceNumber = document.getElementById('filter-invoiceNumber').value;
    const invoiceDate = document.getElementById('filter-invoiceDate').value;
    console.log("Vendor: " + vendor);
    console.log("invoiceNumber: " + invoiceNumber);
    console.log("invoiceDate: " + invoiceDate);
    const params = new URLSearchParams({
      vendor,
      invoiceNumber,
      invoiceDate
    });
    const response = await fetch(`http://${window.miVariable}:3000/invoices/status/1?${params.toString()}`);
    invoices = await response.json();
    console.log(invoices);
    const tableResult = groupByVendors(invoices);
    fillTable(tableResult);
  } catch (error) {
    console.error("Error al obtener los invoices:", error);
  }
}

function sortTableByColumn(colID, order) {
  console.log(`Ordenando columna ${colID} en modo ${order}`);
  const aux = ordenarLista(invoices, colID, order);
  const tableResult = groupByVendors(aux);
  fillTable(tableResult);
  // Aquí irá la lógica de extracción de filas, comparación y re-inserción
}
