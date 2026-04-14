(function () {
  'use strict'

  // TriboCRM embed widget. Drop on any landing page:
  //   <script src="https://api.tribocrm.com.br/public/embed.js"
  //           data-form="EMBED_TOKEN"
  //           data-theme="dark"></script>
  // The widget injects a <div> right after itself and renders the
  // form fields returned by GET /public/forms/:embedToken.

  var currentScript = document.currentScript
  if (!currentScript) {
    var scripts = document.getElementsByTagName('script')
    currentScript = scripts[scripts.length - 1]
  }

  var embedToken = currentScript.getAttribute('data-form')
  var theme = currentScript.getAttribute('data-theme') || 'dark'
  if (!embedToken) {
    console.error('[TriboCRM] data-form attribute is required on the embed script tag')
    return
  }

  // Derive API base from the script src so the widget works against
  // any deploy (staging / prod) without hardcoding a domain.
  var scriptSrc = currentScript.getAttribute('src') || ''
  var apiBase = scriptSrc.replace(/\/public\/embed\.js.*$/, '')
  if (!apiBase) apiBase = ''

  var COLORS = theme === 'light'
    ? { bg: '#ffffff', card: '#f4f5f7', text: '#111318', muted: '#6b7280', border: '#d1d5db', accent: '#f97316' }
    : { bg: '#111318', card: '#1a1d24', text: '#f3f4f6', muted: '#9ca3af', border: '#2a2d35', accent: '#f97316' }

  var container = document.createElement('div')
  container.setAttribute('data-tribocrm-form', embedToken)
  container.style.cssText =
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
    'background:' + COLORS.bg + ';color:' + COLORS.text + ';' +
    'max-width:460px;width:100%;margin:0 auto;padding:24px;border-radius:12px;' +
    'border:1px solid ' + COLORS.border + ';box-sizing:border-box;'
  if (currentScript.parentNode) {
    currentScript.parentNode.insertBefore(container, currentScript.nextSibling)
  } else {
    document.body.appendChild(container)
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }

  function setLoading() {
    container.innerHTML =
      '<div style="text-align:center;padding:20px;color:' + COLORS.muted + ';font-size:13px">Carregando formulário...</div>'
  }

  function setError(msg) {
    container.innerHTML =
      '<div style="text-align:center;padding:20px;color:#ef4444;font-size:13px">' + esc(msg) + '</div>'
  }

  function setSuccess() {
    container.innerHTML =
      '<div style="text-align:center;padding:32px 20px">' +
      '<div style="width:56px;height:56px;border-radius:50%;background:rgba(34,197,94,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">' +
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>' +
      '</div>' +
      '<div style="font-size:16px;font-weight:600;color:' + COLORS.text + ';margin-bottom:6px">Recebemos seu contato!</div>' +
      '<div style="font-size:13px;color:' + COLORS.muted + '">Em breve entraremos em contato.</div>' +
      '</div>'
  }

  function renderForm(formData) {
    var fields = Array.isArray(formData.fieldsConfig) ? formData.fieldsConfig : []

    var html = ''
    html += '<div style="font-size:18px;font-weight:700;color:' + COLORS.text + ';margin-bottom:4px">' + esc(formData.name || 'Fale conosco') + '</div>'
    html += '<div style="font-size:12px;color:' + COLORS.muted + ';margin-bottom:18px">Preencha e entraremos em contato.</div>'
    html += '<form id="tribocrm-form" novalidate>'

    for (var i = 0; i < fields.length; i++) {
      var f = fields[i] || {}
      var label = f.label || f.name || 'Campo ' + (i + 1)
      var key = f.name || f.label || ('field_' + i)
      var required = !!f.required
      var type = f.type === 'email' ? 'email' : f.type === 'tel' || f.type === 'phone' ? 'tel' : 'text'

      html += '<div style="margin-bottom:12px">'
      html += '<label style="display:block;font-size:12px;font-weight:500;color:' + COLORS.text + ';margin-bottom:6px">' +
        esc(label) + (required ? '<span style="color:' + COLORS.accent + '"> *</span>' : '') + '</label>'
      html += '<input type="' + type + '" name="' + esc(key) + '"' + (required ? ' required' : '') +
        ' style="width:100%;box-sizing:border-box;background:' + COLORS.card + ';border:1px solid ' + COLORS.border +
        ';border-radius:8px;padding:10px 12px;font-size:14px;color:' + COLORS.text +
        ';outline:none;font-family:inherit" />'
      html += '</div>'
    }

    html += '<button type="submit" id="tribocrm-submit" style="width:100%;background:' + COLORS.accent + ';color:#fff;border:none;border-radius:8px;padding:12px 16px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:4px;transition:opacity 0.15s">Enviar</button>'
    html += '<div id="tribocrm-error" style="display:none;margin-top:10px;padding:8px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:6px;color:#ef4444;font-size:12px"></div>'
    html += '<div style="text-align:center;font-size:10px;color:' + COLORS.muted + ';margin-top:14px">Powered by <strong style="color:' + COLORS.accent + '">TriboCRM</strong></div>'
    html += '</form>'

    container.innerHTML = html

    var form = container.querySelector('#tribocrm-form')
    var btn = container.querySelector('#tribocrm-submit')
    var errBox = container.querySelector('#tribocrm-error')

    form.addEventListener('submit', function (evt) {
      evt.preventDefault()
      errBox.style.display = 'none'
      btn.disabled = true
      btn.style.opacity = '0.6'
      btn.style.cursor = 'not-allowed'
      btn.textContent = 'Enviando...'

      var payload = {}
      var inputs = form.querySelectorAll('input')
      for (var j = 0; j < inputs.length; j++) {
        payload[inputs[j].name] = inputs[j].value
      }

      fetch(apiBase + '/public/forms/' + encodeURIComponent(embedToken) + '/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j } }) })
        .then(function (res) {
          if (res.ok && res.body && res.body.success) {
            setSuccess()
          } else {
            var msg = (res.body && res.body.error && res.body.error.message) || 'Erro ao enviar. Tente novamente.'
            errBox.textContent = msg
            errBox.style.display = 'block'
            btn.disabled = false
            btn.style.opacity = '1'
            btn.style.cursor = 'pointer'
            btn.textContent = 'Enviar'
          }
        })
        .catch(function () {
          errBox.textContent = 'Falha de conexão. Verifique sua internet e tente novamente.'
          errBox.style.display = 'block'
          btn.disabled = false
          btn.style.opacity = '1'
          btn.style.cursor = 'pointer'
          btn.textContent = 'Enviar'
        })
    })
  }

  setLoading()

  fetch(apiBase + '/public/forms/' + encodeURIComponent(embedToken))
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j } }) })
    .then(function (res) {
      if (res.ok && res.body && res.body.success) {
        renderForm(res.body.data)
      } else {
        setError('Formulário indisponível.')
      }
    })
    .catch(function () { setError('Não foi possível carregar o formulário.') })
})()
