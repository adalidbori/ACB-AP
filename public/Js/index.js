
window.miVariable = "localhost";

// Función para obtener los invoices y llenar la tabla
let invoices = [];

document.getElementById("openSettings").addEventListener("click", function () {
    const targetUrl = "/user-management";
    window.location.href = targetUrl;
});

async function updateElement(invoiceId, rowData) {
  // Lista de campos permitidos (deben coincidir con lo que espera el servidor)
  const allowedFields = ['docName', 'invoiceNumber', 'referenceNumber', 'vendor', 'invoiceTotal', 'invoiceDate', 'dueDate'];

  // Itera sobre cada propiedad en rowData
  for (const field in rowData) {
    if (allowedFields.includes(field)) {
      const value = rowData[field];
      try {
        const response = await fetch(`http://${window.miVariable}:3000/invoices/${invoiceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field, value })
        });
        const result = await response.json();
        loadInvoices();
      } catch (error) {
        console.error(`Error actualizando ${field}:`, error);
      }
    }
  }
}

async function getSASUrl(documentUrl) {
  try {
    // Realiza la solicitud POST al servidor
    const response = await fetch(`http://${window.miVariable}:3000/open-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: documentUrl }) // Envía la URL del documento en el cuerpo de la solicitud
    });

    // Verifica si la respuesta es exitosa
    if (!response.ok) {
      throw new Error(`Error en la solicitud: ${response.statusText}`);
    }

    // Analiza la respuesta JSON
    const result = await response.json();
    // Verifica si la respuesta contiene la nueva URL
    if (result.newUrl) {
      // Abre la nueva URL en una ventana nueva
      return result.newUrl;
    } else {
      return '';
    }
  } catch (error) {
    console.error("Error al abrir el documento:", error);
    return '';
  }
}

async function openDocument(documentUrl) {
  try {
    const sasUrl = await getSASUrl(documentUrl);

    if (!sasUrl) {
      console.error("No se obtuvo una URL válida");
      return;
    }
    window.open(sasUrl, '_blank', 'noopener');
  } catch (error) {
    console.error("Error crítico al abrir el documento:", error);
    // Puedes mostrar un mensaje al usuario aquí
  }
}


async function showDocument(url, fileType) {
  const sasUrl = await getSASUrl(url);
  if (sasUrl) {
    const viewerContent = document.getElementById('viewer-content');
    if (!viewerContent) {
      console.error("No se encontró el contenedor con id 'viewer-content'");
      return;
    }

    // Dependiendo del tipo de archivo, muestra una imagen o un iframe
    if (fileType === "image/png" || fileType === "image/jpeg") {
      viewerContent.innerHTML = `<img src="${sasUrl}" alt="Documento" style="max-width:100%; height:auto;">`;
    } else {
      viewerContent.innerHTML = `<iframe src="${sasUrl}" style="width:100%; height:600px;" frameborder="0"></iframe>`;
    }
  }

}

// Función para limitar caracteres visibles en celdas editables
function limitCellText(text, maxLength = 20) {
  if (!text || text.length <= maxLength) return text;

  // Guardar el texto completo como atributo data y mostrar versión truncada
  return `<span 
    title="${text}" 
    data-full-text="${text}" 
    class="truncated-text">${text.substring(0, maxLength)}...</span>`;
}

function addNotesBulk() {
  const checkboxes = document.querySelectorAll('.row-checkbox');
  const idsToEdit = [];
  checkboxes.forEach(chk => {
    if (chk.checked) {
      const row = chk.closest('tr');
      const id = row.dataset.id;
      if (id) {
        idsToEdit.push(parseInt(id, 10));
      }
    }
  });

  if (idsToEdit.length === 0) {
    alert("At least one row most be selected.");
    return;
  }

  showNotesModalBulk(idsToEdit);
}

async function showNotesModalBulk(invoiceIds) {
  console.log(invoiceIds);
  const modalEl = document.getElementById('exampleModal');

  // Asigna el listener para guardar (usando onclick para evitar acumulación de listeners)
  const saveButton = modalEl.querySelector('.modal-save-button');
  saveButton.onclick = async () => {
    const notesContent = modalEl.querySelector('#notes-text').value;
    await insertUpdateNotes(invoiceIds, notesContent);
    // Cierra el modal
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
  };

  // Mostrar el modal
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

function editVendor() {
  // Recopilar los IDs de las filas seleccionadas
  const checkboxes = document.querySelectorAll('.row-checkbox');
  const idsToEdit = [];
  checkboxes.forEach(chk => {
    if (chk.checked) {
      const row = chk.closest('tr');
      const id = row.dataset.id;
      if (id) {
        idsToEdit.push(parseInt(id, 10));
      }
    }
  });

  if (idsToEdit.length === 0) {
    alert("At least one row most be selected.");
    return;
  }

  const modalEl = document.getElementById('editModalId');

  // Asigna el listener para guardar (usando onclick para evitar acumulación de listeners)
  const saveButton = modalEl.querySelector('#saveVendorButton');
  saveButton.onclick = async () => {
    const texto = document.getElementById('vendor-input');
    const valor = texto.value.trim(); // Elimina espacios al inicio y al final

    if (valor === "") {
      alert("The field cannot be empty.");
    } else {
      try {
        const response = await fetch(`http://${window.miVariable}:3000/editVendors`, {
          method: "PUT", // Se cambia a PUT
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idsToEdit, valor })
        });

        const result = await response.json();
        console.log("Resultado de la actualización:", result);
        modal.hide();
        loadInvoices();
      } catch (error) {
        console.error("Error editando los vendors!", error);
      }
    }
  };
  // Mostrar el modal
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  // Agrega el listener para limpiar el contenido del modal cuando se cierra
  modalEl.addEventListener('hidden.bs.modal', () => {
    // Reinicia el valor del input (y otros elementos si es necesario)
    const input = modalEl.querySelector('#vendor-input');
    if (input) {
      input.value = '';
    }
    // Si agregaste otros elementos o estados, reinícialos aquí
  }, { once: true }); // Con { once: true } nos aseguramos que el listener se ejecute solo una vez
}

async function deleteInvoiceByID(invoiceID) {
  try {
    // Enviar petición DELETE al servidor con los IDs a eliminar
    const response = await fetch(`http://${window.miVariable}:3000/invoices`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: invoiceID })
    });

    const result = await response.json();
    console.log("Resultado de la eliminación:", result);
  } catch (error) {
    console.error("Error eliminando registros:", error);
  }
}

async function updateStatus(invoiceStatus) {
  // Recopilar los IDs de las filas seleccionadas
  const checkboxes = document.querySelectorAll('.row-checkbox');
  const idsToChange = [];
  const urlsToDelete = [];

  if (invoiceStatus === 6) {

    checkboxes.forEach(chk => {
      if (chk.checked) {
        const row = chk.closest('tr');
        const id = row.dataset.id;
        const url = row.dataset.url;
        if (id) {
          idsToChange.push(parseInt(id, 10));
        }
        if (url) {
          urlsToDelete.push(url);
        }
      }
    });
  } else {
    checkboxes.forEach(chk => {
      if (chk.checked) {
        const row = chk.closest('tr');
        const id = row.dataset.id;
        if (id) {
          idsToChange.push(parseInt(id, 10));
        }
      }
    });
  }



  if (idsToChange.length === 0) {
    alert("At least one row most be selected.");
    return;
  }

  try {
    // Enviar petición Update al servidor con los IDs a actualizar
    const response = await fetch(`http://${window.miVariable}:3000/invoices/update/${invoiceStatus}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: idsToChange })
    });

    const result = await response.json();
    console.log("Resultado de la actualización:", result);

    // Si la eliminación es exitosa, remover las filas del DOM
    checkboxes.forEach(chk => {
      if (chk.checked) {
        const row = chk.closest('tr');
        row.remove();
      }
    });
  } catch (error) {
    console.error("Error actualizando registros:", error);
  }
  loadInvoices();
}

async function getNotes(invoiceId) {
  try {
    const response = await fetch(`http://${window.miVariable}:3000/invoices/notes/${invoiceId}`);
    const data = await response.json();
    // Suponiendo que 'data' es un arreglo de notas
    if (data.length > 0) {
      // Si existe alguna nota, la retornamos
      return data[0].content;
    } else {
      // Si no existe, retornamos una cadena vacía
      return '';
    }
  } catch (error) {
    console.error("Error al obtener las notas:", error);
    return '';
  }
}

async function insertUpdateNotes(invoiceID, content) {
  const formattedContent = content.replace(/\r?\n/g, '\r\n');
  try {
    const response = await fetch(`http://${window.miVariable}:3000/notes-upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        invoiceID: invoiceID,
        content: formattedContent,
        userID: 1 //temporal value
      })
    });
    const serverResponse = await response.json();
    loadInvoices();
    return serverResponse.text;
  } catch (error) {
    console.error("Error en la inserción:", error);
    throw error;
  }
}

async function showNotesModal(invoiceId, invoiceNumber) {
  currentInvoiceId = invoiceId;
  const modalEl = document.getElementById('exampleModal');
  modalEl.querySelector('.modal-title').textContent = `Notes: ${invoiceNumber}`;

  // Obtener las notas de forma asincrónica y asignarlas al textarea
  const notesContent = await getNotes(invoiceId);
  modalEl.querySelector('#notes-text').value = notesContent;

  // Asigna el listener para guardar (usando onclick para evitar acumulación de listeners)
  const saveButton = modalEl.querySelector('.modal-save-button');
  saveButton.onclick = async () => {
    const notesContent = modalEl.querySelector('#notes-text').value;
    await insertUpdateNotes(invoiceId, notesContent);
    // Cierra el modal
    const modal = bootstrap.Modal.getInstance(modalEl);
    modal.hide();
  };

  // Mostrar el modal
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

async function downloadSelectedFiles() {
  const checkboxes = document.querySelectorAll('.row-checkbox:checked');
  if (checkboxes.length === 0) {
    alert('At least one row must be selected.');
    return;
  }

  // Agrupar archivos por proveedor
  const filesByVendor = {};
  for (const checkbox of checkboxes) {
    const fileURL = await getSASUrl(checkbox.dataset.fileurl);
    const fileType = checkbox.dataset.filetype;
    const row = checkbox.closest('tr');
    const docName = row.dataset.timestampName;
    console.log(docName);
    const vendor = row.querySelector('[data-field="vendor"]').textContent.trim();
    const extension = obtenerExtension(fileType);
    const fileName = `${docName.split('.')[0]}${extension}`;

    if (!filesByVendor[vendor]) {
      filesByVendor[vendor] = [];
    }
    filesByVendor[vendor].push({ fileURL, fileName });
  }

  // Para cada proveedor, descargar individual o en ZIP según cantidad
  for (const [vendor, files] of Object.entries(filesByVendor)) {
    if (files.length === 1) {
      // Solo un archivo para este proveedor: descarga directa
      const { fileURL, fileName } = files[0];
      try {
        const response = await fetch(fileURL, { mode: 'cors' });
        if (!response.ok) throw new Error(`Error downloading ${fileName}`);
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
      } catch (error) {
        console.error(`No se pudo descargar el archivo ${fileName}:`, error);
      }
    } else {
      // Múltiples archivos para este proveedor: generar ZIP
      const zip = new JSZip();
      for (const { fileURL, fileName } of files) {
        try {
          const response = await fetch(fileURL, { mode: 'cors' });
          if (!response.ok) throw new Error(`Error downloading ${fileName}`);
          const blob = await response.blob();
          zip.file(fileName, blob);
        } catch (error) {
          console.error(`No se pudo agregar el archivo ${fileName} al ZIP:`, error);
        }
      }

      try {
        const zipContent = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipContent);
        link.download = `${vendor}.zip`;
        link.click();
      } catch (error) {
        console.error(`No se pudo generar el ZIP para ${vendor}:`, error);
      }
    }
  }
}




function obtenerExtension(fileType) {
  switch (fileType) {
    case 'application/pdf':
      return '.pdf';
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    // Agrega más casos según sea necesario
    default:
      return '';
  }
}

function parseInternationalCurrency(amountStr) {
  return parseFloat(amountStr) || 0;
}

// Notification banner functionality
const notificationBanner = document.getElementById('notification-banner');
const notificationMessage = document.getElementById('notification-message');
const notificationClose = document.getElementById('notification-close');

// Close notification banner
notificationClose.addEventListener('click', function () {
  notificationBanner.style.display = 'none';
});

// Filter collapse functionality
const filterHeader = document.getElementById('filter-header');
const filterCollapse = document.getElementById('filterCollapse');
const filterArrow = document.querySelector('.filter-arrow');
const tableResponsive = document.querySelector('.table-responsive');
filterHeader.addEventListener('click', function () {
  const isCollapsed = filterCollapse.classList.contains('show');
  if (isCollapsed) {
    filterCollapse.classList.remove('show');
    filterArrow.style.transform = 'rotate(-90deg)';
    console.log("Cerrado");
    tableResponsive.style.maxHeight = '550px';
  } else {
    filterCollapse.classList.add('show');
    filterArrow.style.transform = 'rotate(0deg)';
    console.log("Abierto");
    tableResponsive.style.maxHeight = '400px';
  }
});

async function getDuplicatedByInvoiceNumber(texto) {
  const tableBody = document.querySelector("#duplicated-table tbody");
  const modalEl = document.getElementById('duplicatedElementsbyIDModal');
  try {
    const response = await fetch(`http://${window.miVariable}:3000/getDuplicatedByInvoiceNumber`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ texto })
    });
    if (!response.ok) {
      throw new Error('Error en la respuesta: ' + response.status);
    }
    const data = await response.json();
    data.forEach(invoice => {
      const tr = document.createElement("tr");
      tr.dataset.id = invoice.ID;
      tr.dataset.invoiceStatus = invoice.invoiceStatus;
      tr.dataset.url = invoice.fileURL;


      console.log("El vendor es: " + invoice.fileType);
      tr.innerHTML = `
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
          <td><div data-field="invoiceNumber" style="${invoice.invoiceNumber ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceNumber}</div></td>
          <td><div data-field="vendor" style="${invoice.vendor ? '' : 'background-color: #f8d7da;'}">${limitCellText(invoice.vendor)}</div></td>
          <td>
          <div data-field="referenceNumber" style="${invoice.referenceNumber ? '' : 'background-color: #f8d7da;'}">${invoice.referenceNumber}</div></td>
          <td><div data-field="invoiceTotal" style="${invoice.invoiceTotal ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceTotal}</div></td>
          <td><div data-field="invoiceDate" style="${invoice.invoiceDate ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceDate}</div></td>
          <td>
            <div data-field="invoiceStatus" style="${invoice.invoiceStatus ? '' : 'background-color: #f8d7da;'}">
              ${getInvoiceStatusText(invoice.invoiceStatus)}
            </div>
          </td>
          <td><div data-field="checknumber" style="${invoice.checknumber ? '' : 'background-color: #f8d7da;'}">${invoice.checknumber}</div></td>
          <td>
            <div style="text-align: center; cursor: pointer;">
              <!-- Se asigna un color por defecto (rojo) y luego se actualizará en función de la existencia de notas -->
              <div class="contenedor-icono">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="red" class="bi bi-trash" viewBox="0 0 16 16">
                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                  <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
                </svg>
              </div>
            </div>
          </td>
        `;

      // Obtener el elemento SVG recién creado
      const svgElement = tr.querySelector('.bi-trash');

      // Asignar el controlador de eventos al SVG
      svgElement.addEventListener('click', function (event) {
        const invoiceId = tr.dataset.id;
        const urlToDelete = tr.dataset.url;
        deleteInvoiceByID(invoiceId);
        eliminarBlobMultiInvoice(urlToDelete);
        tr.remove();
      });
      tableBody.appendChild(tr);
    })

    //Show the modal here
    // Seleccionar el tbody de la tabla



    if (modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    } else {
      console.error('El elemento modal no fue encontrado en el DOM.');
    }
    // Mostrar el modal
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  } catch (error) {
    console.error("Error getting the duplicated invoices", error);
  }

  modalEl.addEventListener('hidden.bs.modal', function () {
    //limpiar la tabla
    tableBody.innerHTML = "";
    // Buscar y eliminar el backdrop si aún existe
    const backdrop = document.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.parentNode.removeChild(backdrop);
    }
    loadInvoices();
  });
}


function generateNotificationLinks(invoiceNumbers) {
  if (invoiceNumbers.length > 0) {
    const linksContainer = document.getElementById('notification-links');

    // Limpia el contenedor para evitar duplicados si se vuelve a ejecutar
    linksContainer.innerHTML = '';

    invoiceNumbers.forEach((number, index) => {
      const link = document.createElement('a');
      link.href = `#`; // Define el destino real si es necesario
      link.textContent = number;
      link.addEventListener('click', function (event) {
        event.preventDefault(); // Prevenir la acción por defecto del enlace
        getDuplicatedByInvoiceNumber(this.textContent); // Llama a la función pasando el textContent
      });

      linksContainer.appendChild(link);

      // Agrega una coma y espacio después de cada enlace (menos el último)
      if (index < invoiceNumbers.length - 1) {
        linksContainer.appendChild(document.createTextNode(', '));
      }
    });
    document.getElementById('notification-banner').style.display = 'flex';
  }
}

async function getDuplicatedInvoices() {
  try {
    const response = await fetch(`http://${window.miVariable}:3000/getDuplicatedInvoices`);

    if (!response.ok) {
      throw new Error('Error en la respuesta: ' + response.status);
    }

    const data = await response.json();
    const invoiceNumbers = data.map(item => item.invoiceNumber);
    generateNotificationLinks(invoiceNumbers);
  } catch (error) {
    console.error('Error fetching duplicated invoices:', error);
  }
}

async function eliminarBlobMultiInvoice(urls) {
  try {
    // Enviar petición DELETE para Azure
    const response = await fetch(`http://${window.miVariable}:3000/eliminar-blob`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls })
    });
    const result = await response.json();
    console.log("Resultado de la eliminación de Azure Blob:", result);
  }
  catch (error) {
    console.error("Error eliminando registros Blob:", error);
  }
}

const headers = document.querySelectorAll('#editable-table thead th');
headers.forEach((th, colIndex) => {
  const title = th.textContent.trim();
  if (!title) return;               // Saltamos celdas sin texto
  th.dataset.order = 'none';        // Estado inicial

  th.style.cursor = 'pointer';      // Cambiamos el cursor para indicar clickeable

  th.addEventListener('click', () => {
    // 1. Determinar nuevo estado
    const current = th.dataset.order;
    const nextOrder = current === 'asc'
      ? 'desc'
      : 'asc';

    // 2. Guardar el nuevo estado en el atributo data-order
    th.dataset.order = nextOrder;

    // 3. (Opcional) Actualizar clases para iconos
    headers.forEach(h => {
      h.classList.remove('sort-asc', 'sort-desc');
    });
    th.classList.add(nextOrder === 'asc' ? 'sort-asc' : 'sort-desc');
    const field = th.id;

    // 4. Disparar tu función de ordenamiento, pasándole:
    //    - el índice de columna (colIndex)
    //    - la dirección (nextOrder)
    sortTableByColumn(field, nextOrder);
  });
});




setTimeout(() => {
  //generateNotificationLinks()
  getDuplicatedInvoices();

}, 5000);

function getInvoiceStatusText(status) {
  switch (status) {
    case 1:
      return "Pending to Review";
    case 2:
      return "Waiting for Approval";
    case 3:
      return "Ready to Pay";
    case 4:
      return "Paid";
    default:
      return "";
  }
}

function fillTable(invoiceList) {
  // Recorrer cada grupo y agregar las filas en la tabla
  console.log(invoiceList);
  for (const vendor in invoiceList) {
    // Crear fila de cabecera para cada vendor
    const headerRow = document.createElement("tr");
    headerRow.classList.add("vendor-header");
    headerRow.dataset.vendor = vendor;
    headerRow.innerHTML = `
      <td colspan="9" style="background:#f0f0f0;">
        <input type="checkbox" class="vendor-checkbox" data-vendor="${vendor}" style="margin-right: 10px; cursor: pointer;">
        <strong style="cursor: pointer;">${vendor}</strong>
      </td>`;

    // ---- Obtener referencias al área clickeable del nombre y al nuevo checkbox ----
    const vendorNameStrong = headerRow.querySelector("strong");
    const vendorCheckbox = headerRow.querySelector(".vendor-checkbox");

    // ---- Evento de Clic para Contraer/Expandir (ahora en el nombre) ----
    // Se asocia solo al nombre para no interferir con el checkbox
    vendorNameStrong.addEventListener('click', function () {
      const currentVendor = headerRow.dataset.vendor; // Obtenemos el vendor desde el data-attribute de la fila
      const invoiceRows = document.querySelectorAll(`tr.invoice-row[data-vendor="${currentVendor}"]`);
      invoiceRows.forEach(row => {
        row.style.display = row.style.display === 'none' ? '' : 'none';
      });
    });

    // MODIFICACIÓN 2: Agregar Evento de Cambio al Checkbox de Cabecera ----
    vendorCheckbox.addEventListener('change', function (event) {
      const isChecked = event.target.checked; // Estado del checkbox de cabecera (true si está marcado)
      const currentVendor = event.target.dataset.vendor; // Vendor asociado a este checkbox

      // Seleccionar todos los checkboxes DENTRO de las filas de factura para este vendor
      const invoiceCheckboxes = document.querySelectorAll(`tr.invoice-row[data-vendor="${currentVendor}"] .row-checkbox`);

      // Iterar sobre los checkboxes de las facturas y establecer su estado 'checked'
      invoiceCheckboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
        // Opcional: podrías querer disparar el evento 'change' en cada checkbox individual
        // si tienes otra lógica que depende de ello, aunque usualmente no es necesario
        // checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      });
      console.log('vendor checkbox');
      updateVendorHeaderTotal(currentVendor);
      actualizarTotalSiNoHayCheckboxMarcado();
      updateTotalSelected();
    });

    tableBody.appendChild(headerRow);
    // Agregar cada factura asociada al vendor
    for (const invoice of invoiceList[vendor].invoices) {
      const tr = document.createElement("tr");
      tr.classList.add("invoice-row");
      tr.dataset.vendor = invoice.vendor;
      tr.dataset.id = invoice.ID;
      tr.dataset.url = invoice.fileURL;
      tr.dataset.timestampName = invoice.timestampName;
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
    <td><div class="editable-cell" data-field="docName" contenteditable="true" style="${invoice.docName ? '' : 'background-color: #f8d7da;'}">${limitCellText(invoice.docName)}</div></td>
    <td><div class="editable-cell" data-field="invoiceNumber" contenteditable="true" style="${invoice.invoiceNumber ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceNumber}</div></td>
    <td class="hidden-column"><div class="editable-cell" data-field="vendor" contenteditable="true" style="${invoice.vendor ? '' : 'background-color: #f8d7da;'}">${invoice.vendor}</div></td>
    <td><div class="editable-cell" data-field="referenceNumber" contenteditable="true" style="${invoice.referenceNumber ? '' : 'background-color: #f8d7da;'}">${invoice.referenceNumber}</div></td>
    <td><div class="editable-cell" data-field="invoiceTotal" contenteditable="true" style="${invoice.invoiceTotal ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceTotal}</div></td>
    <td><div class="editable-cell" data-field="invoiceDate" contenteditable="true" style="${invoice.invoiceDate ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceDate}</div></td>
    <td><div class="editable-cell" data-field="dueDate" contenteditable="true" style="${invoice.dueDate ? '' : 'background-color: #f8d7da;'}">${invoice.dueDate}</div></td>
    <td>
      <div style="text-align: center;">
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
        updateTotalSelected();
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
        $${invoiceList[vendor].total.toLocaleString('en-US', {
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
            invoiceTotalDiv.textContent = "$" + invoiceList[vendor].total.toLocaleString('en-US', {
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
}



function ordenarLista(lista, campo, orden = 'asc') {
  return lista.slice().sort((a, b) => {
    let valorA = a[campo];
    let valorB = b[campo];

    // Verificamos si el campo es una fecha
    if (campo.toLowerCase().includes('date')) {
      valorA = new Date(valorA);
      valorB = new Date(valorB);
    }
    // Si el campo es 'invoiceTotal', lo parseamos como float limpiando caracteres
    else if (campo === 'invoiceTotal') {
      valorA = parseFloat(valorA.replace(/[^0-9.-]+/g, '')) || 0;
      valorB = parseFloat(valorB.replace(/[^0-9.-]+/g, '')) || 0;
    }
    // Si el campo es 'checknumber', parseamos a entero
    else if (campo === 'checknumber') {
      valorA = parseInt(valorA, 10) || 0;
      valorB = parseInt(valorB, 10) || 0;
    }
    // Si es string, comparamos alfabéticamente
    else if (typeof valorA === 'string' && typeof valorB === 'string') {
      return orden === 'asc'
        ? valorA.localeCompare(valorB)
        : valorB.localeCompare(valorA);
    }

    // Comparación numérica (para fechas ya transformadas o números)
    return orden === 'asc'
      ? valorA - valorB
      : valorB - valorA;
  });
}


function groupByVendors(invoices) {
  tableBody.innerHTML = ""; // Limpiar contenido previo
  // Agrupar facturas por vendor y sumar los totales usando el formato internacional
  // Modificamos el valor inicial del reduce y la lógica interna
  const invoiceSummary = invoices.reduce((accumulator, invoice) => {
    // 'accumulator' ahora contiene tanto los grupos como el total general.
    // Estructura esperada de accumulator: { groups: { ... }, totalOwe: 0 }

    const vendor = invoice.vendor;

    // Accedemos al objeto de grupos DENTRO del acumulador
    if (!accumulator.groups[vendor]) {
      accumulator.groups[vendor] = { invoices: [], total: 0 };
    }

    // Agregamos la factura al grupo correspondiente dentro del acumulador
    accumulator.groups[vendor].invoices.push(invoice);

    // Convertimos el invoiceTotal a número (asumiendo que parseInternationalCurrency devuelve un número)
    // Esta función ya debería manejar la conversión a float/número.
    const amount = parseInternationalCurrency(invoice.invoiceTotal);

    // Sumamos al total del vendor específico
    accumulator.groups[vendor].total += amount;

    // *** NUEVO: Sumamos al total general (totalOwe) en el acumulador ***
    accumulator.totalOwe += amount;

    // Devolvemos el acumulador completo para la siguiente iteración
    return accumulator;

  }, { groups: {}, totalOwe: 0 }); // <--- Valor inicial del acumulador modificado

  // Después del reduce, los resultados están en 'invoiceSummary'
  const groupedInvoices = invoiceSummary.groups; // Los grupos como antes
  const totalSpan = document.querySelector('.total-span');
  const totalOwe = `$${invoiceSummary.totalOwe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;     // El total general calculado
  totalSpan.textContent = totalOwe;
  console.log("Total Adeudado General:", totalOwe);
  return groupedInvoices;
}

function updateTotalSelected() {
  const checkboxes = document.querySelectorAll('.row-checkbox');
  let count = 0;

  checkboxes.forEach(checkbox => {
    if (checkbox.checked) {
      count++;
    }
  });

  const selectedSpan = document.querySelector('.items-selected');
  if (selectedSpan) {
    selectedSpan.textContent = count;
  }
}

function logoutUser() {
  fetch("/logout", {
    method: "POST",
    credentials: "include", // si usas cookies
  })
    .then(res => res.json())
    .then(data => {
      console.log(data);
      // Redirigir si es necesario
      window.location.href = "/login";
    })
    .catch(error => console.error("Error:", error));

}