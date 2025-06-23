
// Función para obtener los invoices y llenar la tabla
document.addEventListener('DOMContentLoaded', () => {
  // 1. Añade los listeners a los encabezados ESTÁTICOS de la tabla una vez.
  initializeTableSorting();
  setTimeout(() => {
    //generateNotificationLinks()
    console.log("Time Out");
    getDuplicatedInvoices();

  }, 5000);

  closeDuplicateBanner();
});
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
        const response = await fetch(`/invoices/${invoiceId}`, {
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
    const response = await fetch(`/open-document`, {
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
        const response = await fetch(`/editVendors`, {
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
    const response = await fetch(`/invoices`, {
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

  if (invoiceStatus === 6) {

    checkboxes.forEach(chk => {
      if (chk.checked) {
        const row = chk.closest('tr');
        const id = row.dataset.id;
        const url = row.dataset.url;
        if (id) {
          idsToChange.push(parseInt(id, 10));
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
    const response = await fetch(`/invoices/update/${invoiceStatus}`, {
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
    const response = await fetch(`/invoices/notes/${invoiceId}`);
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
    const response = await fetch(`/notes-upsert`, {
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

function closeDuplicateBanner() {
  // Notification banner functionality
  const notificationBanner = document.getElementById('notification-banner');
  const notificationClose = document.getElementById('notification-close');

  // Close notification banner
  notificationClose.addEventListener('click', function () {
    notificationBanner.style.display = 'none';
  });
}

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
    const response = await fetch(`/getDuplicatedByInvoiceNumber`, {
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

function initializeTableSorting() {
  const headers = document.querySelectorAll('.editable-table thead th');

  // Si no hay encabezados, no hagas nada.
  if (headers.length === 0) return;

  headers.forEach((th, colIndex) => {
    // Evita añadir el mismo listener múltiples veces
    if (th.dataset.listenerAttached === 'true') return;

    const title = th.textContent.trim();
    if (!title) return;
    th.dataset.order = 'none';
    th.style.cursor = 'pointer';

    th.addEventListener('click', () => {
      const current = th.dataset.order;
      const nextOrder = current === 'asc' ? 'desc' : 'asc';

      th.dataset.order = nextOrder;

      headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
      th.classList.add(nextOrder === 'asc' ? 'sort-asc' : 'sort-desc');

      const field = th.id;
      sortTableByColumn(field, nextOrder);
    });

    // Marca el encabezado para no volver a añadirle el listener
    th.dataset.listenerAttached = 'true';
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
    const response = await fetch(`/getDuplicatedInvoices`);

    if (!response.ok) {
      throw new Error('Error en la respuesta: ' + response.status);
    }

    const data = await response.json();
    const invoiceNumbers = data.map(item => item.invoiceNumber);
    console.log(invoiceNumbers);
    generateNotificationLinks(invoiceNumbers);
  } catch (error) {
    console.error('Error fetching duplicated invoices:', error);
  }
}

async function eliminarBlobMultiInvoice(urls) {
  try {
    // Enviar petición DELETE para Azure
    const response = await fetch(`/eliminar-blob`, {
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
  // Limpiamos el cuerpo de la tabla antes de redibujar
  tableBody.innerHTML = "";

  const sortedVendors = Object.keys(invoiceList).sort((a, b) => a.localeCompare(b));

  for (const vendor of sortedVendors) {
    const sortedInvoices = invoiceList[vendor].invoices.sort((a, b) => new Date(a.invoiceDate) - new Date(b.invoiceDate));
    const countText = sortedInvoices.length.toString();
    // --- Fila de Cabecera del Vendor ---
    const headerRow = document.createElement("tr");
    headerRow.classList.add("vendor-header");
    headerRow.dataset.vendor = vendor;
    headerRow.innerHTML = `
      <td colspan="9" style="background:#f0f0f0;">
          <input type="checkbox" class="vendor-checkbox" data-vendor="${vendor}" style="margin-right: 10px; cursor: pointer;">
          <strong style="cursor: pointer;">${vendor}</strong> <span style="color: red; font-weight: normal;">(${countText})</span>
      </td>`;
    tableBody.appendChild(headerRow);

    // --- Filas de Facturas ---
    for (const invoice of sortedInvoices) {
      const tr = document.createElement("tr");
      tr.classList.add("invoice-row");
      tr.dataset.vendor = invoice.vendor;
      tr.dataset.id = invoice.ID;
      tr.dataset.url = invoice.fileURL;
      tr.dataset.timestampName = invoice.timestampName;

      if (expandedVendorsState.has(vendor)) {
        tr.style.display = '';
      } else {
        tr.style.display = 'none';
      }

      tr.innerHTML = `
        <td><input type="checkbox" class="row-checkbox" data-fileurl="${invoice.fileURL}" data-filetype="${invoice.fileType}"></td>
        <td><a class="dragout" href='#' onclick="openDocument('${invoice.fileURL}')" draggable="true" data-filename="${invoice.docName}" data-filetype="${invoice.fileType}"><div data-field="fileType">${invoice.fileType.includes('pdf') ? '<img src="/Styles/pdf.svg" alt="PDF">' : '<img src="/Styles/image.svg" alt="Imagen">'}</div></a></td>
        <td><div class="editable-cell" data-field="docName" contenteditable="true" style="${invoice.docName ? '' : 'background-color: #f8d7da;'}">${limitCellText(invoice.docName)}</div></td>
        <td><div class="editable-cell" data-field="invoiceNumber" contenteditable="true" style="${invoice.invoiceNumber ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceNumber}</div></td>
        <td class="hidden-column"><div class="editable-cell" data-field="vendor" contenteditable="true" style="${invoice.vendor ? '' : 'background-color: #f8d7da;'}">${invoice.vendor}</div></td>
        <td><div class="editable-cell" data-field="referenceNumber" contenteditable="true" style="${invoice.referenceNumber ? '' : 'background-color: #f8d7da;'}">${invoice.referenceNumber}</div></td>
        <td><div class="editable-cell" data-field="invoiceTotal" contenteditable="true" style="${invoice.invoiceTotal ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceTotal}</div></td>
        <td><div class="editable-cell" data-field="invoiceDate" contenteditable="true" style="${invoice.invoiceDate ? '' : 'background-color: #f8d7da;'}">${invoice.invoiceDate}</div></td>
        <td><div class="editable-cell" data-field="dueDate" contenteditable="true" style="${invoice.dueDate ? '' : 'background-color: #f8d7da;'}">${invoice.dueDate}</div></td>
        <td><div style="text-align: center;"><div class="contenedor-icono"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" class="bi bi-bell" viewBox="0 0 16 16" style="cursor: pointer;" onclick='showNotesModal("${invoice.ID}", "${invoice.invoiceNumber}")'><path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2M8 1.918l-.797.161A4 4 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4 4 0 0 0-3.203-3.92zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5 5 0 0 1 13 6c0 .88.32 4.2 1.22 6"/></svg></div></div></td>
      `;
      tableBody.appendChild(tr);

      // Listeners específicos para esta fila
      addEventListenersToRow(tr);

      getNotes(invoice.ID)
        .then(notesContent => {
          if (notesContent && notesContent.trim() !== '') {
            tr.querySelector('.contenedor-icono').classList.add("icon");
          }
        })
        .catch(error => console.error("Error al obtener notas:", invoice.ID, error));
    }

    // --- Fila de Total del Vendor ---
    const totalRow = document.createElement("tr");
    totalRow.dataset.totalbyvendor = true;
    totalRow.classList.add("vendor-total");
    totalRow.dataset.vendor = vendor;
    totalRow.innerHTML = `
      <td colspan="4"></td>
      <td style="font-weight: bold; text-align: right;">Total:</td>
      <td style="font-weight: bold; text-align: left;"><div data-field="invoiceTotal">$${invoiceList[vendor].total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></td>
      <td colspan="4"></td>
    `;
    tableBody.appendChild(totalRow);
  }

  // <<< INICIO DE FUNCIONES AUXILIARES DENTRO DE fillTable >>>
  // Ahora estas funciones tienen acceso a 'invoiceList'

  function addEventListenersToRow(tr) {
    // Listener para expandir/contraer
    const vendorNameStrong = document.querySelector(`tr.vendor-header[data-vendor="${tr.dataset.vendor}"] strong`);
    if (vendorNameStrong && !vendorNameStrong.hasAttribute('data-listener-attached')) {
      vendorNameStrong.setAttribute('data-listener-attached', 'true');
      vendorNameStrong.addEventListener('click', function () {
        const currentVendor = tr.dataset.vendor;
        const invoiceRows = document.querySelectorAll(`tr.invoice-row[data-vendor="${currentVendor}"]`);
        const isCurrentlyCollapsed = invoiceRows.length > 0 && invoiceRows[0].style.display === 'none';
        invoiceRows.forEach(row => { row.style.display = isCurrentlyCollapsed ? '' : 'none'; });
        if (isCurrentlyCollapsed) expandedVendorsState.add(currentVendor);
        else expandedVendorsState.delete(currentVendor);
      });
    }

    // Listener para checkbox de cabecera
    const vendorCheckbox = document.querySelector(`tr.vendor-header[data-vendor="${tr.dataset.vendor}"] .vendor-checkbox`);
    if (vendorCheckbox && !vendorCheckbox.hasAttribute('data-listener-attached')) {
      vendorCheckbox.setAttribute('data-listener-attached', 'true');
      vendorCheckbox.addEventListener('change', function (event) {
        const isChecked = event.target.checked;
        const currentVendor = event.target.dataset.vendor;
        document.querySelectorAll(`tr.invoice-row[data-vendor="${currentVendor}"] .row-checkbox`).forEach(cb => { cb.checked = isChecked; });
        updateVendorHeaderTotal(currentVendor);
        updateTotalSelected();
      });
    }

    // Listeners para la fila de factura
    let shouldFireChange = false;
    tr.addEventListener("input", () => { shouldFireChange = true; });
    tr.addEventListener("keydown", (e) => {
      if (e.key === 'Enter' && shouldFireChange) {
        e.preventDefault();
        shouldFireChange = false;
        const rowData = {};
        tr.querySelectorAll('.editable-cell').forEach(cell => { rowData[cell.dataset.field] = cell.textContent.trim(); });
        updateElement(tr.dataset.id, rowData);
        e.target.blur();
      }
    });
    tr.querySelector('.row-checkbox').addEventListener('click', handleCheckboxClick);
    tr.querySelector('.row-checkbox').addEventListener('change', function () {
      if (this.checked) {
        showDocument(this.dataset.fileurl, this.dataset.filetype);
      }
      updateVendorHeaderTotal(this.closest('tr').dataset.vendor);
      updateTotalSelected();
    });
  }

  // Función mejorada para actualizar el total del proveedor
  function updateVendorHeaderTotal(vendor) {
    let sum = 0;
    const vendorRows = document.querySelectorAll(`tr.invoice-row[data-vendor="${vendor}"]`);
    let hasChecked = false;

    vendorRows.forEach(row => {
      const checkbox = row.querySelector('.row-checkbox');
      if (checkbox && checkbox.checked) {
        hasChecked = true;
        const totalDiv = row.querySelector('div[data-field="invoiceTotal"]');
        if (totalDiv) {
          sum += parseInternationalCurrency(totalDiv.textContent);
        }
      }
    });

    const totalRow = document.querySelector(`tr.vendor-total[data-vendor="${vendor}"]`);
    if (totalRow) {
      const totalCell = totalRow.querySelector('div[data-field="invoiceTotal"]');
      let totalToShow;
      if (hasChecked) {
        totalToShow = sum;
      } else {
        // Si no hay ninguno chequeado, usa el total completo que viene de la data original.
        // Ahora SÍ tiene acceso a invoiceList.
        totalToShow = invoiceList[vendor].total;
      }
      totalCell.textContent = `$${totalToShow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  // Función para manejar Ctrl+Click
  function handleCheckboxClick(event) {
    if (!event.ctrlKey) {
      document.querySelectorAll('.row-checkbox').forEach(checkbox => {
        if (checkbox !== event.target) {
          checkbox.checked = false;
        }
      });
    }
  }
  // <<< FIN DE FUNCIONES AUXILIARES DENTRO DE fillTable >>>
}
// Nota: Las demás funciones como `updateVendorHeaderTotal`, `actualizarTotalSiNoHayCheckboxMarcado`, etc.,
// deben existir fuera de `fillTable` para ser accesibles globalmente.

function actualizarTotalSiNoHayCheckboxMarcado() {
  const totalRows = document.querySelectorAll('tr[data-totalbyvendor="true"]');
  totalRows.forEach(row => {
    const vendor = row.dataset.vendor;
    const checkboxMarcado = document.querySelector(`tr.invoice-row[data-vendor="${vendor}"] .row-checkbox:checked`);
    if (!checkboxMarcado) {
      const invoiceTotalDiv = row.querySelector('div[data-field="invoiceTotal"]');
      if (invoiceTotalDiv) {
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
  const vendorRows = document.querySelectorAll(`tr.invoice-row[data-vendor="${vendor}"]`);
  vendorRows.forEach(row => {
    const checkbox = row.querySelector('.row-checkbox');
    if (checkbox && checkbox.checked) {
      const totalDiv = row.querySelector('div[data-field="invoiceTotal"]');
      if (totalDiv) {
        const text = totalDiv.textContent.trim();
        const cleanedText = text.replace(/[^0-9.-]+/g, "");
        const value = parseFloat(cleanedText);
        if (!isNaN(value)) {
          sum += value;
        }
      }
    }
  });
  const totalRow = document.querySelector(`tr[data-vendor="${vendor}"][data-totalbyvendor="true"]`);
  if (totalRow) {
    const totalCell = totalRow.querySelector('div[data-field="invoiceTotal"]');
    if (totalCell) {
      totalCell.textContent = `$${sum.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
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