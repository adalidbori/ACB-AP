// Evento para manejar los dropdowns
document.addEventListener('click', function(event) {
    const target = event.target;

    // Cerrar todos los dropdowns cuando se haga clic en otro lugar
    if (!target.closest('.dropdown-cell')) {
        document.querySelectorAll('.dropdown-options').forEach(dropdown => {
            dropdown.style.display = 'none';
        });
        return;
    }

    // Si el clic fue en una celda dropdown, abrir/cerrar opciones
    if (target.classList.contains('dropdown-cell')) {
        event.stopPropagation();

        // Cerrar otros dropdowns abiertos antes de abrir este
        document.querySelectorAll('.dropdown-options').forEach(dropdown => {
            dropdown.style.display = 'none';
        });

        // Mostrar opciones del dropdown actual
        const dropdownOptions = target.querySelector('.dropdown-options');
        if (dropdownOptions) {
            dropdownOptions.style.display = 'block';
        }
    }

    // Si el clic fue en una opción del dropdown
    if (target.classList.contains('dropdown-option')) {
        event.stopPropagation();

        const selectedValue = target.textContent;
        const dropdownCell = target.closest('.dropdown-cell');

        // Actualizar la celda con la opción seleccionada
        dropdownCell.dataset.value = selectedValue;
        dropdownCell.innerHTML = `${selectedValue}
            <div class="dropdown-options">
                <div class="dropdown-option">Not Started</div>
                <div class="dropdown-option">In Progress</div>
                <div class="dropdown-option">Under Review</div>
                <div class="dropdown-option">Completed</div>
            </div>`;

        // Ocultar el dropdown
        dropdownCell.querySelector('.dropdown-options').style.display = 'none';
    }
});