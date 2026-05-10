import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { execFileSync } from 'child_process'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { PDFDocument, degrees } from 'pdf-lib'
import sharp from 'sharp'
import QRCode from 'qrcode'
import type { Client, User, Settings, ProcessDocument } from '@prisma/client'
import { resolveGenderTerms, resolveMaritalStatus, resolveNationality, resolveDisplayName } from '../utils/gender'
import type { Gender } from '../utils/gender'
import { mascararCPF } from '../utils/cpf'
import { prisma } from '../config/database'

type UserWithSettings = User & { settings?: Settings | null }

const UPLOAD_TEMP_DIR = process.env.UPLOAD_TEMP_DIR ?? '/tmp/juriscontrol'
const PDF_DIR = path.join(UPLOAD_TEMP_DIR, 'pdfs')
const UPLOAD_DIR = path.join(UPLOAD_TEMP_DIR, 'uploads')

function ensurePdfDir() { fs.mkdirSync(PDF_DIR, { recursive: true }) }

function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function pdfDownloadUrl(filename: string): string {
  return `/api/downloads/pdfs/${filename}`
}

export class PDFService {

  private async htmlToPdf(html: string, basename: string): Promise<{ filePath: string; downloadUrl: string; fileHash: string }> {
    ensurePdfDir()

    const executablePath = process.env.CHROMIUM_PATH ?? await chromium.executablePath()
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: null,
      executablePath,
      headless: true,
    })

    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const pdfBytes = await page.pdf({ format: 'A4', printBackground: true })

      const buffer = Buffer.from(pdfBytes)
      const hash = sha256(buffer)
      const filename = `${basename}_${Date.now()}.pdf`
      const filePath = path.join(PDF_DIR, filename)
      fs.writeFileSync(filePath, buffer)

      return { filePath, downloadUrl: pdfDownloadUrl(filename), fileHash: hash }
    } finally {
      await browser.close()
    }
  }

  async isPdfEncrypted(buffer: Buffer): Promise<boolean> {
    try {
      await PDFDocument.load(buffer, { ignoreEncryption: false })
      return false
    } catch {
      return true
    }
  }

  async unlockPdfWithQpdf(inputPath: string, password: string): Promise<string> {
    try {
      execFileSync('which', ['qpdf'], { stdio: 'ignore' })
    } catch {
      throw new Error('QPDF_NOT_AVAILABLE')
    }

    const outputPath = inputPath.replace(/\.pdf$/i, '_unlocked.pdf')
    try {
      execFileSync('qpdf', ['--password', password, '--decrypt', inputPath, outputPath])
      return outputPath
    } catch (err) {
      const msg = (err as { message?: string }).message ?? ''
      if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('incorrect')) {
        throw new Error('WRONG_PASSWORD')
      }
      throw new Error('QPDF_FAILED')
    }
  }

  async generateProcuracao(
    client: Client & { user?: UserWithSettings | null },
    user: UserWithSettings
  ): Promise<{ filePath: string; downloadUrl: string; fileHash: string }> {
    const gender = resolveGenderTerms(client.gender as Gender | null)
    const maritalStatus = resolveMaritalStatus(client.marital_status, client.gender as Gender | null)
    const nationality = resolveNationality(client.nationality, client.gender as Gender | null)
    const displayName = resolveDisplayName(client)
    const hoje = new Date()
    const dia = hoje.getDate().toString()
    const mes = hoje.toLocaleDateString('pt-BR', { month: 'long' })
    const ano = hoje.getFullYear().toString()
    const cpfFormatado = client.cpf
      ? client.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      : ''
    const cepFormatado = client.zip_code
      ? client.zip_code.replace(/(\d{5})(\d{3})/, '$1-$2')
      : ''

    const advGender = resolveGenderTerms(user.gender as Gender | null)
    const advMarital = resolveMaritalStatus(user.marital_status, user.gender as Gender | null)
    const advNationality = resolveNationality('Brasileiro', user.gender as Gender | null)
    const officeName = user.settings?.office_name ?? user.name
    const officeAddress = user.settings?.office_address ?? ''
    const officeLogo = user.settings?.office_logo_url ?? ''

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 2.5cm 3cm 3cm 3cm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; color: #000; margin: 0; padding: 0; }
  .cabecalho { text-align: center; margin-bottom: 8px; }
  .cabecalho .nome-escritorio { font-size: 13pt; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; }
  .cabecalho .subtitulo { font-size: 11pt; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
  .divider-top { border-top: 2px solid #000; margin: 12px 0 4px 0; }
  .titulo-procuracao { text-align: center; font-size: 16pt; font-weight: bold; letter-spacing: 8px; text-decoration: underline; margin: 18px 0 20px 0; text-transform: uppercase; }
  .bloco { border: 1.5px solid #000; padding: 10px 14px; margin-bottom: 12px; }
  .bloco p { margin: 4px 0; text-align: justify; }
  .label { font-weight: bold; text-transform: uppercase; font-size: 11pt; }
  .linha-campo { display: inline; border-bottom: 1px solid #000; min-width: 120px; }
  .bloco-poderes { border: 1.5px solid #000; padding: 12px 14px; margin-bottom: 28px; text-align: justify; }
  .assinatura-area { margin-top: 40px; text-align: center; }
  .assinatura-linha { border-top: 1.5px solid #000; width: 60%; margin: 0 auto 6px auto; }
  .assinatura-nome { font-size: 11pt; font-weight: bold; text-transform: uppercase; }
  .assinatura-label { font-size: 10pt; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
  .rodape { position: fixed; bottom: 1.5cm; left: 3cm; right: 3cm; text-align: center; font-size: 9pt; border-top: 1px solid #888; padding-top: 6px; color: #333; }
</style>
</head>
<body>
<div class="cabecalho">
  ${officeLogo ? `<img src="${officeLogo}" style="height:50px;margin-bottom:8px;" /><br/>` : ''}
  <div class="nome-escritorio">${officeName}</div>
  <div class="subtitulo">Consultoria Jurídica</div>
</div>
<div class="divider-top"></div>
<div class="titulo-procuracao">P R O C U R A Ç Ã O</div>
<div class="bloco">
  <p><span class="label">Outorgante:</span> <span class="linha-campo">&nbsp;${displayName}&nbsp;</span></p>
  <p>
    <span class="label">Nacionalidade:</span> <span class="linha-campo">&nbsp;${nationality}&nbsp;</span>
    &nbsp;&nbsp;
    <span class="label">Estado Civil:</span> <span class="linha-campo">&nbsp;${maritalStatus}&nbsp;</span>
  </p>
  <p>
    <span class="label">Profissão:</span> <span class="linha-campo">&nbsp;${client.profession ?? ''}&nbsp;</span>
    &nbsp;&nbsp;
    <span class="label">Identidade:</span> <span class="linha-campo">&nbsp;${client.rg ?? ''}&nbsp;</span>
  </p>
  <p>
    <span class="label">CPF:</span> <span class="linha-campo">&nbsp;${cpfFormatado}&nbsp;</span>
    &nbsp;&nbsp;
    <span class="label">Endereço:</span> <span class="linha-campo">&nbsp;${client.address ?? ''}&nbsp;</span>
  </p>
  <p>
    <span class="label">N°</span> <span class="linha-campo">&nbsp;${client.address_number ?? ''}&nbsp;</span>
    &nbsp;&nbsp;
    <span class="label">Bairro:</span> <span class="linha-campo">&nbsp;${client.neighborhood ?? ''}&nbsp;</span>
  </p>
  <p>
    <span class="label">Cidade:</span> <span class="linha-campo">&nbsp;${client.city ?? ''}&nbsp;</span>
    &nbsp;&nbsp;
    <span class="label">Estado:</span> <span class="linha-campo">&nbsp;${client.state ?? ''}&nbsp;</span>
    &nbsp;&nbsp;
    <span class="label">CEP:</span> <span class="linha-campo">&nbsp;${cepFormatado}&nbsp;</span>
  </p>
</div>
<div class="bloco">
  <p>
    <span class="label">Outorgado:</span>
    ${advGender.dr} <strong>${user.name.toUpperCase()}</strong>,
    ${advNationality}, ${advMarital},
    advogado${user.gender === 'F' ? 'a' : ''},
    inscrição na OAB/${user.oab_state ?? ''} n.°${user.oab_number ?? ''},
    com endereço profissional na ${officeAddress} –
    e-mail: ${user.email}.
  </p>
</div>
<div class="bloco-poderes">
  <p>
    <span class="label">Poderes:</span>
    da Cláusula <strong>AD JUDICIA</strong>, para o foro em geral, em qualquer instância, Juízo ou Tribunal,
    nas esferas Federal, Estadual e Municipal, podendo propor, contestar, variar ou desistir de ações,
    e os poderes especiais para acordar, transigir, firmar compromissos, dar e receber alvarás para
    levantamento de depósitos judiciais, endossar, receber e dar quitação, processar, pedir a gratuidade
    de justiça e assinar declaração de hipossuficiência econômica. (em conformidade com a norma instituída
    pelo artigo 105 do CPC/2015), enfim todos os demais atos necessários ao bom desempenho deste mandato
    inclusive substabelecer com ou sem reservas de poderes.
  </p>
</div>
<p style="margin-left: 40px;">
  ${client.city ?? ''},
  <span style="border-bottom:1px solid #000">&nbsp;&nbsp;&nbsp;${dia}&nbsp;&nbsp;&nbsp;</span>
  de
  <span style="border-bottom:1px solid #000">&nbsp;&nbsp;&nbsp;${mes}&nbsp;&nbsp;&nbsp;</span>
  de ${ano}.
</p>
<div class="assinatura-area">
  <div class="assinatura-linha"></div>
  <div class="assinatura-nome">${displayName}</div>
  <div class="assinatura-label">Outorgante</div>
</div>
<div class="rodape">
  ${officeAddress}${user.email ? ' | e-mail: ' + user.email : ''}${user.phone ? ' | ' + user.phone : ''}
</div>
</body>
</html>`

    return this.htmlToPdf(html, `procuracao_${client.id}`)
  }

  async generateRequerimento(params: {
    process: { id: string; case_title: string; process_number?: string | null; client: { full_name: string; cpf?: string | null } }
    user: UserWithSettings
    htmlContent: string
    videoLinks: Array<{ title: string; url: string; description?: string }>
  }): Promise<{ filePath: string; downloadUrl: string; fileHash: string }> {
    const { process: proc, user, htmlContent, videoLinks } = params
    const cpfMascarado = proc.client.cpf ? mascararCPF(proc.client.cpf) : ''
    const dataHoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    const officeName = user.settings?.office_name ?? user.name
    const officeLogo = user.settings?.office_logo_url ?? ''
    const advGender = resolveGenderTerms(user.gender as Gender | null)
    const oab = user.oab_number ? `OAB/${user.oab_state ?? ''} ${user.oab_number}` : ''

    const videoSection = videoLinks.length > 0 ? `
      <hr style="border-top:2px solid #333;margin:20px 0 8px 0"/>
      <p style="font-weight:bold;text-transform:uppercase;font-size:11pt;">Provas Digitais Disponíveis:</p>
      <ol>
        ${videoLinks.map((v, i) => `
          <li style="margin-bottom:8px;">
            <strong>${v.title}</strong><br/>
            Link: <a href="${v.url}">${v.url}</a>
            ${v.description ? `<br/>${v.description}` : ''}
          </li>
        `).join('')}
      </ol>` : ''

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 2.5cm 3cm 3cm 3cm; }
  body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; color: #000; margin: 0; }
  .header { text-align: center; margin-bottom: 16px; }
  hr.thick { border: none; border-top: 2px solid #333; margin: 12px 0; }
  .title { font-size: 14pt; font-weight: bold; text-align: center; text-transform: uppercase; margin: 12px 0; }
  .meta p { margin: 2px 0; }
  .content { margin: 20px 0; text-align: justify; }
  .footer { margin-top: 30px; }
</style>
</head>
<body>
<div class="header">
  ${officeLogo ? `<img src="${officeLogo}" style="height:50px;margin-bottom:8px;" /><br/>` : ''}
  <strong>${officeName}</strong>
</div>
<hr class="thick"/>
<div class="title">REQUERIMENTO</div>
<div class="meta">
  <p><strong>Cliente:</strong> ${proc.client.full_name}</p>
  ${cpfMascarado ? `<p><strong>CPF:</strong> ${cpfMascarado}</p>` : ''}
  ${proc.process_number ? `<p><strong>Processo:</strong> ${proc.process_number}</p>` : ''}
</div>
<hr class="thick"/>
<div class="content">${htmlContent}</div>
${videoSection}
<hr class="thick"/>
<div class="footer">
  <p>${dataHoje}</p>
  <p>${advGender.dr} ${user.name}${oab ? ' | ' + oab : ''}</p>
</div>
</body>
</html>`

    return this.htmlToPdf(html, `requerimento_${proc.id}`)
  }

  async generateProcessoPDF(params: {
    processId: string
    documentIdsOrdem: string[]
    userId: string
  }): Promise<{ filePath: string; downloadUrl: string; fileHash: string; pageCount: number }> {
    const { processId, documentIdsOrdem, userId } = params

    const CATEGORIAS_FIXAS = ['procuracao', 'identidade', 'cnh', 'comprovante_residencia']
    const ORDEM_FIXA: Record<string, number> = { procuracao: 1, identidade: 2, cnh: 2, comprovante_residencia: 3 }

    const allDocs = await prisma.processDocument.findMany({
      where: {
        process_id: processId,
        process: { user_id: userId },
        deleted_at: null,
        file_path: { not: null },
      },
    })

    const fixedDocs = allDocs
      .filter(d => CATEGORIAS_FIXAS.includes(d.document_type))
      .sort((a, b) => (ORDEM_FIXA[a.document_type] ?? 9) - (ORDEM_FIXA[b.document_type] ?? 9))

    const variableDocs = allDocs.filter(d => !CATEGORIAS_FIXAS.includes(d.document_type))
    const orderedIds = new Map(documentIdsOrdem.map((id, i) => [id, i]))
    variableDocs.sort((a, b) => {
      const ai = orderedIds.get(a.id) ?? (1000 + a.order_index)
      const bi = orderedIds.get(b.id) ?? (1000 + b.order_index)
      return ai - bi
    })

    const sortedDocs = [...fixedDocs, ...variableDocs]

    const finalDoc = await PDFDocument.create()

    for (const doc of sortedDocs) {
      const buffer = fs.readFileSync(doc.file_path!)
      const mime = doc.file_mime ?? doc.file_type ?? ''

      if (mime === 'application/pdf') {
        const srcDoc = await PDFDocument.load(buffer)
        if (doc.rotation !== 0) {
          srcDoc.getPages().forEach(page => {
            const current = page.getRotation().angle
            page.setRotation(degrees((current + doc.rotation) % 360))
          })
        }
        const copied = await finalDoc.copyPages(srcDoc, srcDoc.getPageIndices())
        copied.forEach(p => finalDoc.addPage(p))
      } else {
        const sharpImg = sharp(buffer)
        if (doc.rotation !== 0) sharpImg.rotate(doc.rotation)
        const jpegBuffer = await sharpImg.jpeg({ quality: 90 }).toBuffer()

        const imgDoc = await PDFDocument.create()
        const img = await imgDoc.embedJpg(jpegBuffer)
        const pageW = 595.28, pageH = 841.89
        const margin = 20
        const scale = Math.min((pageW - margin * 2) / img.width, (pageH - margin * 2) / img.height, 1)
        const page = imgDoc.addPage([pageW, pageH])
        page.drawImage(img, {
          x: (pageW - img.width * scale) / 2,
          y: (pageH - img.height * scale) / 2,
          width: img.width * scale,
          height: img.height * scale,
        })
        const copied = await finalDoc.copyPages(imgDoc, imgDoc.getPageIndices())
        copied.forEach(p => finalDoc.addPage(p))
      }
    }

    const pdfBytes = await finalDoc.save()
    const buffer = Buffer.from(pdfBytes)
    const hash = sha256(buffer)
    const pageCount = finalDoc.getPageCount()
    const filename = `processo_${processId}_${Date.now()}.pdf`
    const filePath = path.join(PDF_DIR, filename)
    ensurePdfDir()
    fs.writeFileSync(filePath, buffer)

    return { filePath, downloadUrl: pdfDownloadUrl(filename), fileHash: hash, pageCount }
  }

  async generateVideosPDF(params: {
    caseTitle: string
    processNumber: string | null
    clientName: string
    videos: Array<{ title: string; url: string; description: string }>
    user: UserWithSettings
  }): Promise<{ filePath: string; downloadUrl: string; fileHash: string }> {
    const { caseTitle, processNumber, clientName, videos, user } = params

    const officeName = user.settings?.office_name ?? user.name
    const officeLogo = user.settings?.office_logo_url ?? ''
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

    const qrDataUrls = await Promise.all(
      videos.map(v => QRCode.toDataURL(v.url, { width: 128, margin: 1 }))
    )

    const videoCards = videos.map((v, i) => `
      <div class="video-card">
        <img class="qr" src="${qrDataUrls[i]}" alt="QR Code">
        <div class="info">
          <div class="title">${i + 1}. ${v.title}</div>
          <div class="url">${v.url}</div>
          ${v.description ? `<div class="desc">${v.description}</div>` : ''}
        </div>
      </div>`
    ).join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 2cm 2.5cm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #111; margin: 0; }
  .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 18px; }
  .header .office { font-size: 14pt; font-weight: bold; }
  .header .subtitle { font-size: 10pt; color: #555; margin-top: 2px; }
  .section-title { font-size: 13pt; font-weight: bold; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 1px; }
  .video-card { display: flex; gap: 14px; align-items: flex-start; border: 1px solid #ddd; border-radius: 6px; padding: 12px; margin-bottom: 12px; page-break-inside: avoid; }
  .qr { width: 90px; height: 90px; flex-shrink: 0; }
  .info { flex: 1; }
  .title { font-weight: bold; font-size: 12pt; margin-bottom: 4px; }
  .url { font-family: monospace; font-size: 8.5pt; color: #1a5276; word-break: break-all; margin-bottom: 4px; }
  .desc { font-size: 10pt; color: #444; margin-top: 4px; }
  .footer { position: fixed; bottom: 1cm; left: 2.5cm; right: 2.5cm; text-align: center; font-size: 8.5pt; color: #888; border-top: 1px solid #ccc; padding-top: 6px; }
</style>
</head>
<body>
<div class="header">
  ${officeLogo ? `<img src="${officeLogo}" style="height:36px;margin-bottom:6px;display:block;">` : ''}
  <div class="office">${officeName}</div>
  <div class="subtitle">
    ${caseTitle}${processNumber ? ` — Processo ${processNumber}` : ''}
    &nbsp;|&nbsp; Cliente: ${clientName}
  </div>
</div>
<div class="section-title">Mídias Digitais (${videos.length} ${videos.length === 1 ? 'vídeo' : 'vídeos'})</div>
${videoCards}
<div class="footer">Documento gerado em ${hoje} | ${officeName}</div>
</body>
</html>`

    const basename = `midias_${Date.now()}`
    return this.htmlToPdf(html, basename)
  }
}

export const pdfService = new PDFService()
