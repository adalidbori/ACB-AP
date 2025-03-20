
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
  try {
    const uploadResponse = await fetch(`http://${window.miVariable}:3000/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await uploadResponse.json();
    const timestampName = data.filename;
    // Obtenemos el texto extraído del archivo
    const operationn = await operationLocation(data.url);//Obtener el operationLocation
    const textoJson = await getExtractedTextPost(operationn);//Llamar al operationLocation para obtener el Json con los datos
    const finalText = frmattingTexto(textoJson);

    // Llamamos a ChatGPT usando el texto extraído
    const chatGPTResponse = await callChatGPT(finalText);
    const responseObject = extractJson(chatGPTResponse);
    if (responseObject.invoices.length === 1) {
      const id = await insertRecord(file.name, timestampName, file.type, data.url, responseObject.invoices[0]);
    } else {
      // setup the pdf4meClient
      const url = data.url;
      const promises = responseObject.invoices.map(invoice => extractPages(url, invoice));
      await Promise.all(promises);
      eliminarBlobMultiInvoice(data.url);
    }

    loadInvoices();
  } catch (error) {
    console.error("Error en el proceso:", error);
  }
}

async function eliminarBlobMultiInvoice(url) {
  try {
    // Enviar petición DELETE para Azure
    const response = await fetch(`http://${window.miVariable}:3000/eliminar-blob`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: url })
    });
    const result = await response.json();
    console.log("Resultado de la eliminación de Azure Blob:", result);
  }
  catch (error) {
    console.error("Error eliminando registros Blob:", error);
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
    const invoices = await response.json();
    tableBody.innerHTML = ""; // Limpiar contenido previo

    // Agrupar facturas por vendor y sumar los totales usando el formato internacional
    const groupedInvoices = invoices.reduce((groups, invoice) => {
      const vendor = invoice.vendor;
      if (!groups[vendor]) {
        groups[vendor] = { invoices: [], total: 0 };
      }
      groups[vendor].invoices.push(invoice);
      const amount = parseInternationalCurrency(invoice.invoiceTotal);
      groups[vendor].total += amount;
      return groups;
    }, {});

    // Recorrer cada grupo y agregar las filas en la tabla
    for (const vendor in groupedInvoices) {
      // Crear fila de cabecera para cada vendor
      const headerRow = document.createElement("tr");
      headerRow.classList.add("vendor-header");
      headerRow.dataset.vendor = vendor;
      headerRow.innerHTML = `
        <td colspan="9" style="background:#f0f0f0; cursor: pointer;">
          <strong>${vendor}</strong></td>`;

      // Agregar evento de clic para contraer/expandir
      headerRow.addEventListener('click', function () {
        // Seleccionar todas las filas de factura para este vendor
        const invoiceRows = document.querySelectorAll(`tr.invoice-row[data-vendor="${vendor}"]`);
        invoiceRows.forEach(row => {
          // Alternar visibilidad: si está oculto, se muestra; si se muestra, se oculta
          row.style.display = row.style.display === 'none' ? '' : 'none';
        });
      });

      tableBody.appendChild(headerRow);

      // Agregar cada factura asociada al vendor
      for (const invoice of groupedInvoices[vendor].invoices) {
        const tr = document.createElement("tr");
        tr.classList.add("invoice-row");
        // Asignar el vendor para relacionarlas con la cabecera
        tr.dataset.vendor = invoice.vendor;
        tr.dataset.id = invoice.ID;

        tr.innerHTML = `
          <td>
            <input type="checkbox" class="row-checkbox" data-fileurl="${invoice.fileURL}" data-filetype="${invoice.fileType}">
          </td>
          <td>
            <a class="dragout" href='#'
              onclick="openDocument('${invoice.fileURL}')" 
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
          <td><div class="editable-cell" data-field="docName" contenteditable="true" style="${invoice.docName ? '' : 'background-color: #f8d7da;'}">${invoice.docName}</div></td>
          <td><div class="editable-cell" data-field="invoiceNumber" contenteditable="true" style="${invoice.invoiceNumber ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceNumber}</div></td>
          <td><div class="editable-cell" data-field="vendor" contenteditable="true" style="${invoice.vendor ? '' : 'background-color: #f8d7da;'}">${invoice.vendor}</div></td>
          <td><div class="editable-cell" data-field="invoiceTotal" contenteditable="true" style="${invoice.invoiceTotal ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceTotal}</div></td>
          <td><div class="editable-cell" data-field="invoiceDate" contenteditable="true" style="${invoice.invoiceDate ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceDate}</div></td>
          <td><div class="editable-cell" data-field="dueDate" contenteditable="true" style="${invoice.dueDate ? '' : 'background-color: #f8d7da;'}">${invoice.dueDate}</div></td>
          <td>
            <div style="text-align: center;">
              <!-- Se asigna un color por defecto (rojo) y luego se actualizará en función de la existencia de notas -->
              <div class="contenedor-icono">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" class="bi bi-bell" viewBox="0 0 16 16" style="cursor: pointer;" onclick='showNotesModal("${invoice.ID}", "${invoice.invoiceNumber}")'>
                  <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2M8 1.918l-.797.161A4 4 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4 4 0 0 0-3.203-3.92zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5 5 0 0 1 13 6c0 .88.32 4.2 1.22 6"/>
                </svg>

              </div>
            </div>
          </td>
        `;


        // Manejo de edición de celdas
        let shouldFireChange = false;
        tr.addEventListener("input", function () {
          shouldFireChange = true;
        });
        tr.addEventListener("keydown", function (e) {
          if (e.key === 'Enter' && shouldFireChange) {
            shouldFireChange = false;
            const currentRow = this.closest('tr');
            const rowData = {};
            const cells = currentRow.querySelectorAll('.editable-cell[contenteditable="true"]');
            cells.forEach(cell => {
              const field = cell.dataset.field;
              const value = cell.textContent.trim();
              rowData[field] = value;
            });
            updateElement(currentRow.dataset.id, rowData);
          }
        });


        // Evento del checkbox para mostrar documento
        const checkbox = tr.querySelector('.row-checkbox');
        checkbox.addEventListener('change', function () {
          const isChecked = this.checked;
          if (isChecked) {
            showDocument(this.dataset.fileurl, this.dataset.filetype);
          }
          const currentVendor = this.closest('tr').dataset.vendor;
          updateVendorHeaderTotal(currentVendor);
          actualizarTotalSiNoHayCheckboxMarcado();
        });

        tableBody.appendChild(tr);
        // Consultar si la factura tiene notas y actualizar el color del ícono
        getNotes(invoice.ID)
          .then(notesContent => {
            const iconContainer = tr.querySelector('.contenedor-icono');
            if (notesContent && notesContent.trim() !== '') {
              // Si existen notas, se cambia el color (por ejemplo, a verde)
              iconContainer.classList.add("icon");
            }
          })
          .catch(error => {
            console.error("Error al obtener notas para la factura", invoice.ID, error);
          });
      }

      // Agregar fila con el total
      const totalRow = document.createElement("tr");
      totalRow.dataset.totalbyvendor = true;
      totalRow.classList.add("vendor-total");
      totalRow.dataset.vendor = vendor;
      totalRow.innerHTML = `
        <td colspan="4"></td>
        <td style="font-weight: bold; text-align: right;">Total:</td>
        <td style="font-weight: bold; text-align: left;"><div data-field="invoiceTotal">
          $${groupedInvoices[vendor].total.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}
        </div>
        </td>
        <td></td>
        <td></td>
        <td></td>
      `;
      tableBody.appendChild(totalRow);

      const checkboxes = document.querySelectorAll('.row-checkbox');
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('click', handleCheckboxClick);
      });

      // Función para manejar el evento de clic en los checkboxes
      function handleCheckboxClick(event) {
        // Si la tecla Ctrl no está presionada
        if (!event.ctrlKey) {
          // Recorre todos los checkboxes y desmárcalos
          checkboxes.forEach(checkbox => {
            checkbox.checked = false;
          });
          // Marca solo el checkbox que fue clicado
          event.target.checked = true;
        }
        // Si la tecla Ctrl está presionada, permite la selección múltiple
      }

      function actualizarTotalSiNoHayCheckboxMarcado() {
        // Selecciona todas las filas de totales por vendedor
        const totalRows = document.querySelectorAll('tr[data-totalbyvendor="true"]');
        totalRows.forEach(row => {
          const vendor = row.dataset.vendor;
          // Busca si existe al menos un checkbox marcado en las filas de factura de ese vendor
          const checkboxMarcado = document.querySelector(`tr.invoice-row[data-vendor="${vendor}"] .row-checkbox:checked`);
          if (!checkboxMarcado) {
            // Si no hay ninguno marcado, se cambia el valor de la celda invoiceTotal
            const invoiceTotalDiv = row.querySelector('div[data-field="invoiceTotal"]');
            if (invoiceTotalDiv) {
              // Aquí puedes definir el nuevo valor que necesites; en este ejemplo se pone $0.00
              invoiceTotalDiv.textContent = "$" + groupedInvoices[vendor].total.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              });
            }
          }
        });
      }


      function updateVendorHeaderTotal(vendor) {
        let sum = 0;
        // Seleccionar todas las filas del proveedor especificado
        const vendorRows = document.querySelectorAll(`tr.invoice-row[data-vendor="${vendor}"]`);


        vendorRows.forEach(row => {
          const checkbox = row.querySelector('.row-checkbox');
          // Verificar si el checkbox existe y está seleccionado
          if (checkbox && checkbox.checked) {
            const totalDiv = row.querySelector('div[data-field="invoiceTotal"]');
            if (totalDiv) {
              const text = totalDiv.textContent.trim();
              const cleanedText = text.replace(/[^0-9.-]+/g, ""); // Eliminar caracteres no numéricos
              const value = parseFloat(cleanedText);
              if (!isNaN(value)) {
                sum += value;
              } else {
                console.warn(`Valor no numérico encontrado: "${text}"`);
              }
            } else {
              console.warn("Div con data-field='invoiceTotal' no encontrado en la fila");
            }
          }
        });

        // Seleccionar la fila del total del proveedor
        const totalRow = document.querySelector(`tr[data-vendor="${vendor}"][data-totalbyvendor="true"]`);
        if (totalRow) {
          const totalCell = totalRow.querySelector('div[data-field="invoiceTotal"]');
          if (totalCell) {
            // Actualizar el contenido de la celda con el total formateado
            totalCell.textContent = `$${sum.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}`;
          } else {
            console.warn("Div con data-field='invoiceTotal' no encontrado en la fila de total");
          }
        } else {
          console.warn(`Fila de total para el proveedor "${vendor}" no encontrada`);
        }
      }
    }
  } catch (error) {
    console.error("Error al obtener los invoices:", error);
  }

}