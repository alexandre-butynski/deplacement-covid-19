import 'bootstrap/dist/css/bootstrap.min.css'

import './main.css'

import { PDFDocument, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'
import { library, dom } from '@fortawesome/fontawesome-svg-core'
import { faEye, faFilePdf } from '@fortawesome/free-solid-svg-icons'

import { $, $$ } from './dom-utils'
import pdfBase from './certificate.pdf'

const HARDCODED_SORTIE_OFFSET = 15

library.add(faEye, faFilePdf)

dom.watch()

const generateQR = async (text) => {
  try {
    var opts = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
    }
    return await QRCode.toDataURL(text, opts)
  } catch (err) {
    console.error(err)
  }
}

function pad (str) {
  return String(str).padStart(2, '0')
}

function saveProfile () {
  for (const field of $$('#form-profile input')) {
    if (
      field.id === 'field-datesortie' ||
      field.id === 'field-dategeneration'
    ) {
      var dateSortie = field.value.split('-')
      localStorage.setItem(
        field.id.substring('field-'.length),
        `${dateSortie[2]}-${dateSortie[1]}-${dateSortie[0]}`,
      )
    } else {
      localStorage.setItem(field.id.substring('field-'.length), field.value)
    }
  }
}

function getProfile () {
  const fields = {}
  for (let i = 0; i < localStorage.length; i++) {
    const name = localStorage.key(i)
    fields[name] = localStorage.getItem(name)
  }
  return fields
}

function idealFontSize (font, text, maxWidth, minSize, defaultSize) {
  let currentSize = defaultSize
  let textWidth = font.widthOfTextAtSize(text, defaultSize)

  while (textWidth > maxWidth && currentSize > minSize) {
    textWidth = font.widthOfTextAtSize(text, --currentSize)
  }

  return textWidth > maxWidth ? null : currentSize
}

async function generatePdf (profile, reasons) {
  // const creationDate = new Date().toLocaleDateString('fr-FR')
  // const creationHour = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')

  const {
    lastname,
    firstname,
    birthday,
    lieunaissance,
    address,
    zipcode,
    town,
    datesortie,
    heuresortie,
    dategeneration,
    heuregeneration,
  } = profile
  const releaseHours = String(heuresortie).substring(0, 2)
  const releaseMinutes = String(heuresortie).substring(3, 5)
  const [d, m, y] = dategeneration.split('-')
  const [h, min] = heuregeneration.split(':')
  const creationDate = new Date(y, m - 1, d).toLocaleDateString('fr-FR')
  const creationHour = new Date(y, m - 1, d, h, min)
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    .replace(':', 'h')

  const data = [
    `Cree le: ${creationDate} a ${creationHour}`,
    `Nom: ${lastname}`,
    `Prenom: ${firstname}`,
    `Naissance: ${birthday} a ${lieunaissance}`,
    `Adresse: ${address} ${zipcode} ${town}`,
    `Sortie: ${datesortie} a ${releaseHours}h${releaseMinutes}`,
    `Motifs: ${reasons}`,
  ].join('; ')

  const existingPdfBytes = await fetch(pdfBase).then((res) =>
    res.arrayBuffer(),
  )

  const pdfDoc = await PDFDocument.load(existingPdfBytes)
  const page1 = pdfDoc.getPages()[0]

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const drawText = (text, x, y, size = 11) => {
    page1.drawText(text, { x, y, size, font })
  }

  drawText(`${firstname} ${lastname}`, 123, 686)
  drawText(birthday, 123, 661)
  drawText(lieunaissance, 92, 638)
  drawText(`${address} ${zipcode} ${town}`, 134, 613)

  if (reasons.includes('travail')) {
    drawText('x', 76, 527, 19)
  }
  if (reasons.includes('courses')) {
    drawText('x', 76, 478, 19)
  }
  if (reasons.includes('sante')) {
    drawText('x', 76, 436, 19)
  }
  if (reasons.includes('famille')) {
    drawText('x', 76, 400, 19)
  }
  if (reasons.includes('sport')) {
    drawText('x', 76, 345, 19)
  }
  if (reasons.includes('judiciaire')) {
    drawText('x', 76, 298, 19)
  }
  if (reasons.includes('missions')) {
    drawText('x', 76, 260, 19)
  }
  let locationSize = idealFontSize(font, profile.town, 83, 7, 11)

  if (!locationSize) {
    alert(
      'Le nom de la ville risque de ne pas être affiché correctement en raison de sa longueur. ' +
        'Essayez d\'utiliser des abréviations ("Saint" en "St." par exemple) quand cela est possible.',
    )
    locationSize = 7
  }

  drawText(profile.town, 111, 226, locationSize)

  if (reasons !== '') {
    // Date sortie
    drawText(`${profile.datesortie}`, 92, 200)
    drawText(releaseHours, 200, 201)
    drawText(releaseMinutes, 220, 201)
  }

  // Date création
  drawText('Date de création:', 464, 150, 7)
  drawText(`${creationDate} à ${creationHour}`, 455, 144, 7)

  const generatedQR = await generateQR(data)

  const qrImage = await pdfDoc.embedPng(generatedQR)

  page1.drawImage(qrImage, {
    x: page1.getWidth() - 170,
    y: 155,
    width: 100,
    height: 100,
  })

  pdfDoc.addPage()
  const page2 = pdfDoc.getPages()[1]
  page2.drawImage(qrImage, {
    x: 50,
    y: page2.getHeight() - 350,
    width: 300,
    height: 300,
  })

  const pdfBytes = await pdfDoc.save()

  return new Blob([pdfBytes], { type: 'application/pdf' })
}

function downloadBlob (blob, fileName) {
  const link = document.createElement('a')
  var url = URL.createObjectURL(blob)
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
}

function getAndSaveReasons () {
  const values = $$('input[name="field-reason"]:checked')
    .map((x) => x.value)
    .join('-')
  localStorage.setItem('reasons', values)
  return values
}

// see: https://stackoverflow.com/a/32348687/1513045
function isFacebookBrowser () {
  const ua = navigator.userAgent || navigator.vendor || window.opera
  return ua.includes('FBAN') || ua.includes('FBAV')
}

if (isFacebookBrowser()) {
  $('#alert-facebook').value =
    "ATTENTION !! Vous utilisez actuellement le navigateur Facebook, ce générateur ne fonctionne pas correctement au sein de ce navigateur ! Merci d'ouvrir Chrome sur Android ou bien Safari sur iOS."
  $('#alert-facebook').classList.remove('d-none')
}

function addSlash () {
  $('#field-birthday').value = $('#field-birthday').value.replace(
    /^(\d{2})$/g,
    '$1/',
  )
  $('#field-birthday').value = $('#field-birthday').value.replace(
    /^(\d{2})\/(\d{2})$/g,
    '$1/$2/',
  )
  $('#field-birthday').value = $('#field-birthday').value.replace(/\/\//g, '/')
}

$('#field-birthday').onkeyup = function () {
  const key = event.keyCode || event.charCode
  if (key === 8 || key === 46) {
    return false
  } else {
    addSlash()
    return false
  }
}

const snackbar = $('#snackbar')

$('#btn-delete-localstorage').addEventListener(
  'click',
  () => localStorage.clear() || window.location.reload(),
)

$('#generate-btn').addEventListener('click', async (event) => {
  event.preventDefault()

  saveProfile()
  const reasons = getAndSaveReasons()
  const profile = getProfile()
  const pdfBlob = await generatePdf(profile, reasons)
  // localStorage.clear();
  const { dategeneration, heuregeneration } = profile
  const [d, m, y] = dategeneration.split('-')
  const [h, min] = heuregeneration.split(':')
  const creationDate = new Date(y, m - 1, d).toLocaleDateString('fr-CA')
  const creationHour = new Date(y, m - 1, d, h, min)
    .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    .replace(':', '-')
  downloadBlob(pdfBlob, `attestation-${creationDate}_${creationHour}.pdf`)

  snackbar.classList.remove('d-none')
  setTimeout(() => snackbar.classList.add('show'), 100)

  setTimeout(function () {
    snackbar.classList.remove('show')
    setTimeout(() => snackbar.classList.add('d-none'), 500)
  }, 6000)
})

$$('input').forEach((input) => {
  const exempleElt = input.parentNode.parentNode.querySelector('.exemple')
  if (input.placeholder && exempleElt) {
    input.addEventListener('input', (event) => {
      if (input.value) {
        exempleElt.innerHTML = 'ex.&nbsp;: ' + input.placeholder
      } else {
        exempleElt.innerHTML = ''
      }
    })
  }
})

const stringified = (date) => ({
  year: date.getFullYear(),
  month:
    date.getMonth() + 1 < 10 ? pad(date.getMonth() + 1) : date.getMonth() + 1,
  day: date.getDate() < 10 ? pad(date.getDate()) : date.getDate(),
  hours: date.getHours() < 10 ? pad(date.getHours()) : date.getHours(),
  minutes: date.getMinutes() < 10 ? pad(date.getMinutes()) : date.getMinutes(),
})

const inputFields = {
  '#field-firstname': {
    condition: 'length',
    defaultFn: () => '',
  },
  '#field-lastname': {
    condition: 'length',
    defaultFn: () => '',
  },
  '#field-birthday': {
    condition: 'pattern',
    pattern: /^([0][1-9]|[1-2][0-9]|30|31)\/([0][1-9]|10|11|12)\/(19[0-9][0-9]|20[0-1][0-9]|2020)/g,
    defaultFn: () => '',
  },
  '#field-lieunaissance': {
    condition: 'length',
    defaultFn: () => '',
  },
  '#field-address': {
    condition: 'length',
    defaultFn: () => '',
  },
  '#field-town': {
    condition: 'length',
    defaultFn: () => '',
  },
  '#field-zipcode': {
    condition: 'pattern',
    pattern: /\d{5}/g,
    defaultFn: () => '',
  },
  '#field-datesortie': {
    condition: 'pattern',
    pattern: /\d{4}-\d{2}-\d{2}/g,
    defaultFn: () => {
      const today = new Date()
      return [
        stringified(today).year,
        stringified(today).month,
        stringified(today).day,
      ].join('-')
    },
  },
  '#field-heuresortie': {
    condition: 'pattern',
    pattern: /\d{2}:\d{2}/g,
    defaultFn: () => {
      // sets the time at which you left to a multiple of 5
      const roundedTimestamp =
        Math.round(
          (new Date().getTime() / 60000 - HARDCODED_SORTIE_OFFSET) / 5,
        ) *
        5 *
        60000
      const date = new Date(roundedTimestamp)
      return `${stringified(date).hours}:${stringified(date).minutes}`
    },
  },
  '#field-dategeneration': {
    condition: 'pattern',
    pattern: /\d{4}-\d{2}-\d{2}/g,
    defaultFn: () => {
      const today = new Date()
      return [
        stringified(today).year,
        stringified(today).month,
        stringified(today).day,
      ].join('-')
    },
  },
  '#field-heuregeneration': {
    condition: 'pattern',
    pattern: /\d{2}:\d{2}/g,
    defaultFn: () => {
      const [minOffset, maxOffset] = [1, 6]
      const randomOffset = Math.random() * maxOffset + minOffset
      const generationTime = new Date(
        new Date().getTime() - (HARDCODED_SORTIE_OFFSET + randomOffset) * 60000,
      )

      return `${stringified(generationTime).hours}:${
        stringified(generationTime).minutes
      }`
    },
  },
};

// restore reasons from localstorage
(localStorage.getItem('reasons') || '').split('-').forEach((reasonValue) => {
  if ($(`[name="field-reason"][value="${reasonValue}"]`)) { $(`[name="field-reason"][value="${reasonValue}"]`).checked = true }
})

Object.keys(inputFields).forEach((field) => {
  // restore fields from localstorage
  $(field).value =
    (field.indexOf('date') + field.indexOf('heure') === -2
      ? localStorage.getItem(field.substring('#field-'.length))
      : false) || inputFields[field].defaultFn()
  // set validation
  $(field).addEventListener('input', () => {
    if (inputFields[field].condition === 'pattern') {
      const pattern = inputFields[field].pattern
      if ($(field).value.match(pattern)) {
        $(field).setAttribute('aria-invalid', 'false')
      } else {
        $(field).setAttribute('aria-invalid', 'true')
      }
    }
    if (inputFields[field].condition === 'length') {
      if ($(field).value.length > 0) {
        $(field).setAttribute('aria-invalid', 'false')
      } else {
        $(field).setAttribute('aria-invalid', 'true')
      }
    }
  })
})