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
    const response = await fetch("http://localhost:3000/insert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        docName: docName,
        timestampName: timestampName,
        vendor: chatGPTData.vendor_name,
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
    console.log("Respuesta del servidor:", serverResponse.invoiceId);
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

  try {
    const uploadResponse = await fetch("http://localhost:3000/upload", {
      method: "POST",
      body: formData,
    });
    const data = await uploadResponse.json();
    const timestampName = data.filename;
    // Obtenemos el texto extraído del archivo
    const texto = await extractText(data.url);


    // Llamamos a ChatGPT usando el texto extraído
    const chatGPTResponse = await callChatGPT(texto);

    const responseObject = JSON.parse(chatGPTResponse);

    const id = await insertRecord(file.name, timestampName, file.type, data.url, responseObject);
    console.log(responseObject);

    // Se agrega el archivo a la lista, incluyendo el texto extraído y la respuesta de ChatGPT
    addFileToList(file.name, data.url, file.type, responseObject, id);
  } catch (error) {
    console.error("Error en el proceso:", error);
  }
}




async function extractText(url) {
  const filePath = url;
  try {
    const response = await fetch('http://localhost:3000/extract-text', {
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
    return data.text;
  } catch (error) {
    console.error('Error al realizar la solicitud:', error);
    throw error;
  }
}


function addFileToList(name, url, filetype, data, id) {

  const newRow = document.createElement('tr');
  newRow.dataset.id = id;
  console.log(id);
  newRow.innerHTML = `
        <td>
          <input type="checkbox" class="row-checkbox">
        </td>
        <td>
            <a id="dragout" href='${url}' 
              target="_blank" 
              rel="noopener noreferrer" 
              draggable="true"
              data-filename="${name}" 
              data-filetype="${filetype}">
              <div data-field="fileType">
                ${filetype === 'application/pdf'
                    ? '<img src="/Styles/pdf.svg" alt="Icono PDF">'
                    : '<img src="/Styles/image.svg" alt="Icono imagen">'
                  }
              </div>
            </a>
        </td>
        <td><div class="editable-cell" data-field="docName" contenteditable="true">${name}</div></td>
        <td><div class="editable-cell" data-field="invoiceNumber" contenteditable="true">${data.invoice_number}</div></td>
        <td><div class="editable-cell" data-field="vendor" contenteditable="true">${data.vendor_name}</div></td>
        <td><div class="editable-cell" data-field="invoiceTotal" contenteditable="true">${data.invoice_total}</div></td>
        <td><div class="editable-cell" data-field="invoiceDate" contenteditable="true">${data.invoice_date}</div></td>
        <td><div class="editable-cell" data-field="dueDate" contenteditable="true">${data.invoice_due_date}</div></td>
        <td>
          <div data-field="deadline">
            <a href="#" onclick="showDocument('${url}', '${filetype}'); return false;">Show</a>
          </div>
        </td>
      `;
      let shouldFireChange = false;
      newRow.addEventListener("input", function () {
        shouldFireChange = true;

      });
      newRow.addEventListener("keydown", function (e) {
        if (e.key === 'Enter') {
          if (shouldFireChange) {
            shouldFireChange = false;
            const currentRow = this.closest('tr');
            const rowData = {};
            const cells = currentRow.querySelectorAll('.editable-cell[contenteditable="true"]');
            cells.forEach(cell => {
              const field = cell.dataset.field; // Obtener el nombre del campo desde data-field
              const value = cell.textContent.trim(); // Obtener el contenido de la celda
              rowData[field] = value; // Asignar al objeto
            });
            console.log(`Datos de la fila con ID ${id}:`, rowData);
            updateElement(id, rowData);
          }
        }
      });

  tableBody.appendChild(newRow);
}

//Cargar elementos pending to review de la base de datos
async function loadInvoices() {
    try {
      const response = await fetch("http://localhost:3000/invoices/status/1");
      const invoices = await response.json(); // Suponemos que invoices es un arreglo de objetos
      tableBody.innerHTML = ""; // Limpiar contenido previo
  
      invoices.forEach(invoice => {
        const tr = document.createElement("tr");
        tr.dataset.id = invoice.ID
        tr.innerHTML = `
          <td>
            <input type="checkbox" class="row-checkbox">
          </td>
          <td>
            <a id="dragout" href='${invoice.fileURL}' 
              target="_blank" 
              rel="noopener noreferrer" 
              draggable="true"
              data-filename="${invoice.docName}" 
              data-filetype="${invoice.fileType}">
              <div data-field="fileType">
                ${invoice.fileType === 'application/pdf'
                    ? '<img src="/Styles/pdf.svg" alt="Icono PDF">'
                    : '<img src="/Styles/image.svg" alt="Icono imagen">'
                  }
              </div>
            </a>
          </td>
          <td><div class="editable-cell" data-field="docName" contenteditable="true">${invoice.docName}</div></td>
          <td><div class="editable-cell" data-field="invoiceNumber" contenteditable="true">${invoice.invoiceNumber}</div></td>
          <td><div class="editable-cell" data-field="vendor" contenteditable="true">${invoice.vendor}</div></td>
          <td><div class="editable-cell" data-field="invoiceTotal" contenteditable="true">${invoice.invoiceTotal}</div></td>
          <td><div class="editable-cell" data-field="invoiceDate" contenteditable="true">${invoice.invoiceDate}</div></td>
          <td><div class="editable-cell" data-field="dueDate" contenteditable="true">${invoice.dueDate}</div></td>
          <td>
            <div data-field="deadline">
              <a href="#" onclick="showDocument('${invoice.fileURL}', '${invoice.fileType}'); return false;">Show</a>
            </div>
          </td>
        `;
        let shouldFireChange = false;
        tr.addEventListener("input", function () {
          shouldFireChange = true;
  
        });
        tr.addEventListener("keydown", function (e) {
          if (e.key === 'Enter') {
            if (shouldFireChange) {
              shouldFireChange = false;
              const currentRow = this.closest('tr');
              const rowData = {};
              const cells = currentRow.querySelectorAll('.editable-cell[contenteditable="true"]');
              cells.forEach(cell => {
                const field = cell.dataset.field; // Obtener el nombre del campo desde data-field
                const value = cell.textContent.trim(); // Obtener el contenido de la celda
                rowData[field] = value; // Asignar al objeto
              });
              console.log(`Datos de la fila con ID ${currentRow.dataset.id}:`, rowData);
              updateElement(currentRow.dataset.id, rowData);
            }
          }
        });
        tableBody.appendChild(tr);
      });

      document.getElementById("dragout").addEventListener("dragstart", function(evt) {
        // Definimos el tipo MIME del archivo PDF.
        const mimeType = this.getAttribute('data-filetype') || 'application/octet-stream';
        // Definimos el nombre con el que se descargará el archivo.
        const fileName = this.getAttribute('data-filename') || 'archivo';
        // Construimos la URL absoluta del archivo.
        
        const fileUrl = this.href;
        const timestampName = fileUrl.split('/').pop();
        let localUrl = window.location.protocol + "//" + window.location.host + "/uploads/"+timestampName;
        // Establecemos los datos del arrastre en el formato: [mime-type]:[nombre del archivo]:[URL]
        evt.dataTransfer.setData("DownloadURL", `${mimeType}:${fileName}:${localUrl}`);
      }, false);


    } catch (error) {
      console.error("Error al obtener los invoices:", error);
    }
  }