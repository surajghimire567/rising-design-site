const fieldsByCollection = {
  services: [['title', 'Title', 'text', true], ['slug', 'URL slug (optional)', 'text'], ['description', 'Description', 'textarea', true], ['icon', 'Icon or short symbol', 'text'], ['short_label', 'Short label', 'text'], ['sort_order', 'Display order', 'number'], ['is_published', 'Publish this service', 'checkbox']],
  'case-studies': [['title', 'Title', 'text', true], ['slug', 'URL slug (optional)', 'text'], ['summary', 'Summary', 'textarea', true], ['body', 'Project story', 'textarea', true], ['service_id', 'Related service', 'select'], ['project_date', 'Project date', 'date'], ['cover_image', 'Upload cover image', 'file'], ['pdf_attachment', 'Upload optional PDF', 'file'], ['is_published', 'Publish this project', 'checkbox']],
  testimonials: [['client_name', 'Client name', 'text', true], ['company', 'Company', 'text'], ['quote', 'Approved quote', 'textarea', true], ['photo', 'Upload portrait (optional)', 'file'], ['is_published', 'Publish this approved feedback', 'checkbox']],
  team: [['name', 'Name', 'text', true], ['role', 'Role', 'text', true], ['bio', 'Short bio', 'textarea', true], ['photo', 'Upload portrait (optional)', 'file'], ['sort_order', 'Display order', 'number'], ['is_published', 'Publish this profile', 'checkbox']],
};

const form = document.querySelector('#record-form');
const fields = document.querySelector('#fields');
const list = document.querySelector('#record-list');
const collection = document.querySelector('#collection');
const formMessage = document.querySelector('#form-message');
const saveButton = form.querySelector('button[type="submit"]');
let selected = null;
let serviceOptions = [];

function setMessage(message, state = '') {
  formMessage.textContent = message;
  if (state) formMessage.dataset.state = state;
  else delete formMessage.dataset.state;
}

function fieldInput([name, label, type, required], value = '') {
  const wrap = document.createElement('div');
  wrap.className = type === 'checkbox' ? 'admin-field admin-field--checkbox' : 'admin-field';
  const id = `field-${name}`;
  const lab = document.createElement('label');
  lab.htmlFor = id;
  lab.textContent = `${label}${required ? ' *' : ''}`;
  let input;

  if (type === 'textarea') {
    input = document.createElement('textarea');
    input.rows = name === 'body' || name === 'bio' ? 7 : 3;
    input.value = value ?? '';
  } else if (type === 'select') {
    input = document.createElement('select');
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'No related service';
    input.append(empty);
    serviceOptions.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.title;
      option.selected = item.id === value;
      input.append(option);
    });
  } else {
    input = document.createElement('input');
    input.type = type;
    if (type === 'checkbox') input.checked = Number(value) === 1;
    else if (type !== 'file') input.value = value ?? '';
  }

  input.id = id;
  input.name = name;
  if (required) input.required = true;
  if (type === 'number') {
    input.min = '0';
    input.max = '9999';
    input.step = '1';
  }
  if (type === 'file') input.accept = name === 'pdf_attachment' ? '.pdf,application/pdf' : '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
  wrap.append(input, lab);
  if (type === 'file' && value) {
    const note = document.createElement('small');
    note.textContent = 'A file is already attached. Choose another file to replace it.';
    wrap.append(note);
  }
  return wrap;
}

function clearForm() {
  selected = null;
  form.reset();
  form.elements.id.value = '';
  document.querySelector('#form-title').textContent = 'New record';
  document.querySelector('#delete-button').classList.add('hidden');
  setMessage('');
  list.querySelectorAll('[aria-current="true"]').forEach((button) => button.removeAttribute('aria-current'));
}

function loadForm(row) {
  selected = row;
  form.reset();
  form.elements.id.value = row.id;
  document.querySelector('#form-title').textContent = 'Edit record';
  document.querySelector('#delete-button').classList.remove('hidden');
  setMessage('');
  list.querySelectorAll('[aria-current="true"]').forEach((button) => button.removeAttribute('aria-current'));
  list.querySelector(`[data-record-id="${CSS.escape(row.id)}"]`)?.setAttribute('aria-current', 'true');
  fields.replaceChildren(...fieldsByCollection[collection.value].map((definition) => {
    const fileKey = definition[0] === 'cover_image' ? row.cover_image_key : definition[0] === 'pdf_attachment' ? row.pdf_attachment_key : definition[0] === 'photo' ? row.photo_key : '';
    return fieldInput(definition, row[definition[0]] ?? fileKey ?? '');
  }));
}

function makeInquiryCard(row) {
  const card = document.createElement('article');
  card.className = 'inquiry-card';
  const name = document.createElement('strong');
  name.textContent = row.name;
  const contact = document.createElement('p');
  contact.className = 'inquiry-card__meta';
  contact.textContent = `${row.email} · ${row.phone}`;
  const meta = document.createElement('p');
  meta.className = 'inquiry-card__meta';
  meta.textContent = `${row.project_type} · ${row.created_at} · ${row.status}`;
  const message = document.createElement('p');
  message.className = 'inquiry-card__message';
  message.textContent = row.message;
  card.append(name, contact, meta, message);

  if (row.attachment_key) {
    const link = document.createElement('a');
    link.href = `/api/admin/download?key=${encodeURIComponent(row.attachment_key)}`;
    link.textContent = `Download ${row.attachment_name || 'attachment'}`;
    card.append(link);
  }

  const status = document.createElement('select');
  status.className = 'admin-select';
  status.setAttribute('aria-label', `Update inquiry status for ${row.name}`);
  ['new', 'contacted', 'in_progress', 'closed'].forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value.replace('_', ' ');
    option.selected = value === row.status;
    status.append(option);
  });
  status.addEventListener('change', async () => {
    status.disabled = true;
    try {
      const response = await fetch('/api/admin/inquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, status: status.value }),
      });
      if (!response.ok) throw new Error('Could not update this inquiry.');
      row.status = status.value;
      meta.textContent = `${row.project_type} · ${row.created_at} · ${row.status}`;
      setMessage('Inquiry status updated.', 'success');
    } catch {
      status.value = row.status;
      setMessage('Could not update this inquiry. Refresh the list and try again.', 'error');
    } finally {
      status.disabled = false;
    }
  });
  card.append(status);
  return card;
}

async function refresh() {
  const currentCollection = collection.value;
  list.replaceChildren();
  const loading = document.createElement('p');
  loading.className = 'muted';
  loading.textContent = 'Loading…';
  list.append(loading);

  try {
    const response = await fetch(`/api/admin/${currentCollection}`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Could not load records.');
    const { items = [] } = await response.json();
    if (currentCollection === 'case-studies') {
      const serviceResponse = await fetch('/api/admin/services', { credentials: 'same-origin' });
      if (!serviceResponse.ok) throw new Error('Could not load services.');
      serviceOptions = (await serviceResponse.json()).items || [];
    }
    list.replaceChildren();

    if (currentCollection === 'inquiries') {
      fields.replaceChildren();
      document.querySelector('#form-title').textContent = 'Inquiry inbox';
      document.querySelector('#form-actions').classList.add('hidden');
      document.querySelector('#new-button').classList.add('hidden');
      if (!items.length) {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'No consultation requests yet.';
        list.append(empty);
      } else items.forEach((row) => list.append(makeInquiryCard(row)));
      return;
    }

    document.querySelector('#form-actions').classList.remove('hidden');
    document.querySelector('#new-button').classList.remove('hidden');
    fields.replaceChildren(...fieldsByCollection[currentCollection].map((definition) => fieldInput(definition)));
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'No records yet. Use the form to add one.';
      list.append(empty);
    }
    items.forEach((row) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-record-button';
      button.dataset.recordId = row.id;
      button.textContent = row.title || row.name || row.client_name || row.slug;
      button.addEventListener('click', () => loadForm(row));
      list.append(button);
    });
  } catch (error) {
    list.replaceChildren();
    const message = document.createElement('p');
    message.className = 'admin-message';
    message.dataset.state = 'error';
    message.textContent = error.message || 'Could not load records. Please refresh and try again.';
    list.append(message);
  }
}

collection.addEventListener('change', () => {
  clearForm();
  setMessage('');
  void refresh();
});
document.querySelector('#new-button').addEventListener('click', clearForm);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  saveButton.disabled = true;
  setMessage('Saving…');
  try {
    const response = await fetch(`/api/admin/${collection.value}`, { method: 'POST', body: new FormData(form), credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Save failed.');
    setMessage('Saved successfully.', 'success');
    clearForm();
    setMessage('Saved successfully.', 'success');
    await refresh();
  } catch (error) {
    setMessage(error.message || 'Could not save. Please try again.', 'error');
  } finally {
    saveButton.disabled = false;
  }
});

document.querySelector('#delete-button').addEventListener('click', async () => {
  if (!selected || !window.confirm('Delete this record? This cannot be undone.')) return;
  const button = document.querySelector('#delete-button');
  button.disabled = true;
  setMessage('Deleting…');
  try {
    const response = await fetch(`/api/admin/${collection.value}?id=${encodeURIComponent(selected.id)}`, { method: 'DELETE', credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Delete failed.');
    clearForm();
    setMessage('Record deleted.', 'success');
    await refresh();
  } catch (error) {
    setMessage(error.message || 'Could not delete. Please try again.', 'error');
  } finally {
    button.disabled = false;
  }
});

void refresh();
