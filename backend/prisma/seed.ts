import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // ── 1. Usuário advogado ──────────────────────────────────────────────
  const hash = await bcrypt.hash('Admin@2026', 12)
  const advogado = await prisma.user.upsert({
    where: { email: 'adv@lex.m3br.com.br' },
    update: {},
    create: {
      name: 'Dr. Marcelo Melo',
      email: 'adv@lex.m3br.com.br',
      password_hash: hash,
      role: 'advogado',
      oab_number: '123456',
      oab_state: 'RJ',
      phone: '21999990001',
    },
  })
  console.log(`✅ Advogado: ${advogado.email} / senha: Admin@2026`)

  // ── 2. Settings padrão ──────────────────────────────────────────────
  await prisma.settings.upsert({
    where: { user_id: advogado.id },
    update: {},
    create: {
      user_id: advogado.id,
      default_fee_percentage: 30,
      storage_provider: 'onedrive',
      calendar_provider: 'outlook',
      auto_send_whatsapp_reminders: true,
      auto_monitor_court_emails: false,
      gemini_features_enabled: true,
      office_name: 'Escritório Melo & Associados',
      notification_days_before: [3, 2, 1],
    },
  })
  console.log('✅ Settings criadas')

  // ── 3. Template padrão de procuração ───────────────────────────────
  const tmplExist = await prisma.documentTemplate.findFirst({
    where: { user_id: advogado.id, type: 'procuracao' },
  })
  if (!tmplExist) {
    await prisma.documentTemplate.create({
      data: {
        user_id: advogado.id,
        name: 'Procuração Ad Judicia',
        type: 'procuracao',
        is_default: true,
        variables: ['client_name', 'client_cpf', 'client_rg', 'client_address', 'advogado_name', 'advogado_oab', 'city', 'date'],
        content_html: `
<h2 style="text-align:center">PROCURAÇÃO AD JUDICIA ET EXTRA</h2>
<p>
  <strong>{{client_name}}</strong>, {{client_nationality}}, {{client_marital_status}},
  {{client_profession}}, portador(a) do CPF nº {{client_cpf}} e RG nº {{client_rg}},
  residente e domiciliado(a) em {{client_address}},
</p>
<p>
  nomeia e constitui como seu(sua) bastante procurador(a) o(a) Dr(a).
  <strong>{{advogado_name}}</strong>, inscrito(a) na OAB/{{advogado_oab_state}}
  sob o nº {{advogado_oab}}, com escritório profissional à {{office_address}},
</p>
<p>
  conferindo-lhe poderes para o foro em geral, inclusive para desistir, transigir,
  firmar compromisso, receber e dar quitação, substabelecer esta no todo ou em parte,
  com ou sem reservas de iguais poderes, podendo ainda representar o(a) outorgante
  em todos os atos e termos do processo até o seu final.
</p>
<p>{{city}}, {{date}}.</p>
<p style="text-align:center; margin-top: 60px">
  _________________________________<br/>
  {{client_name}}<br/>
  CPF: {{client_cpf}}
</p>
        `.trim(),
      },
    })
    console.log('✅ Template de procuração criado')
  }

  // ── 4. Dois clientes de exemplo ────────────────────────────────────
  const cliente1 = await prisma.client.upsert({
    where: { id: 'seed-client-001' },
    update: {},
    create: {
      id: 'seed-client-001',
      user_id: advogado.id,
      full_name: 'João Carlos da Silva',
      cpf: '123.456.789-00',
      rg: '12.345.678-9',
      email: 'joao.silva@email.com',
      phone: '21988880001',
      whatsapp: '5521988880001',
      address: 'Rua das Flores, 123',
      neighborhood: 'Centro',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zip_code: '20040-020',
      nationality: 'Brasileiro',
      profession: 'Motorista',
      marital_status: 'casado',
      gender: 'M',
      status: 'ativo',
    },
  })

  const cliente2 = await prisma.client.upsert({
    where: { id: 'seed-client-002' },
    update: {},
    create: {
      id: 'seed-client-002',
      user_id: advogado.id,
      full_name: 'Maria Aparecida Souza',
      cpf: '987.654.321-00',
      rg: '98.765.432-1',
      email: 'maria.souza@email.com',
      phone: '21977770002',
      whatsapp: '5521977770002',
      address: 'Avenida Brasil, 456, Apto 201',
      neighborhood: 'Méier',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zip_code: '20720-001',
      nationality: 'Brasileira',
      profession: 'Vendedora',
      marital_status: 'solteiro',
      gender: 'F',
      status: 'ativo',
    },
  })
  console.log(`✅ Clientes: ${cliente1.full_name}, ${cliente2.full_name}`)

  // ── 5. Processo de exemplo com timeline ────────────────────────────
  const processo = await prisma.process.upsert({
    where: { id: 'seed-process-001' },
    update: {},
    create: {
      id: 'seed-process-001',
      user_id: advogado.id,
      client_id: cliente1.id,
      case_title: 'Indenização por Acidente de Trânsito',
      case_description: 'Cliente sofreu acidente de trânsito na Avenida Brasil em jan/2026. Veículo abalroado por terceiro que avançou sinal vermelho. Danos materiais no valor de R$ 8.500,00 e danos morais.',
      process_number: '0012345-67.2026.8.19.0001',
      court: '5ª Vara Cível do Rio de Janeiro',
      judge: 'Dra. Ana Paula Ferreira',
      opposing_party: 'Pedro Alves de Mendonça',
      process_type: 'civil_indenizatorio',
      status: 'em_andamento',
      court_system: 'pje',
      pending_deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 dias
      ai_summary: 'Ação de indenização por acidente de trânsito. Cliente requer ressarcimento dos danos materiais (R$ 8.500) e compensação por danos morais decorrentes de colisão causada por réu que avançou sinal.',
    },
  })

  // Timeline do processo
  const timelineCount = await prisma.processTimeline.count({ where: { process_id: processo.id } })
  if (timelineCount === 0) {
    await prisma.processTimeline.createMany({
      data: [
        {
          process_id: processo.id,
          user_id: advogado.id,
          action_type: 'processo_aberto',
          description: 'Processo cadastrado no sistema.',
        },
        {
          process_id: processo.id,
          user_id: advogado.id,
          action_type: 'documento_adicionado',
          description: 'Boletim de Ocorrência e fotos do acidente anexados.',
        },
        {
          process_id: processo.id,
          user_id: advogado.id,
          action_type: 'status_alterado',
          description: 'Petição inicial protocolada no PJe. Status atualizado para Em andamento.',
        },
      ],
    })
    console.log('✅ Timeline criada')
  }

  // Audiência de conciliação agendada
  const audCount = await prisma.hearing.count({ where: { process_id: processo.id } })
  if (audCount === 0) {
    const audienciaDate = new Date()
    audienciaDate.setDate(audienciaDate.getDate() + 20)
    await prisma.hearing.create({
      data: {
        process_id: processo.id,
        user_id: advogado.id,
        title: 'Audiência de Conciliação',
        hearing_date: audienciaDate,
        hearing_time: '14:00',
        location: '5ª Vara Cível — TJRJ, Fórum Central, Sala 305',
        hearing_type: 'audiencia_conciliacao',
        status: 'agendada',
      },
    })
    console.log('✅ Audiência agendada')
  }

  // Honorários
  const finCount = await prisma.financialRecord.count({ where: { process_id: processo.id } })
  if (finCount === 0) {
    await prisma.financialRecord.create({
      data: {
        process_id: processo.id,
        user_id: advogado.id,
        record_type: 'honorario',
        description: 'Honorários advocatícios — Ação de indenização',
        total_value: 3000,
        payment_type: 'parcelado',
        payment_status: 'parcial',
        installments_total: 3,
        installments_paid: 1,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        installments: {
          createMany: {
            data: [
              { installment_number: 1, value: 1000, due_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), paid_date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000), status: 'pago' },
              { installment_number: 2, value: 1000, due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), status: 'pendente' },
              { installment_number: 3, value: 1000, due_date: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000), status: 'pendente' },
            ],
          },
        },
      },
    })
    console.log('✅ Registro financeiro criado')
  }

  // ── 6. Domínio monitorado ───────────────────────────────────────────
  const domainExists = await prisma.monitoredCourtDomain.findFirst({
    where: { user_id: advogado.id, email_domain: 'pje.jus.br' },
  })
  if (!domainExists) {
    await prisma.monitoredCourtDomain.create({
      data: {
        user_id: advogado.id,
        court_name: 'PJe Nacional',
        email_domain: 'pje.jus.br',
        court_system: 'pje',
        state: 'RJ',
        active: true,
      },
    })
    console.log('✅ Domínio monitorado: pje.jus.br')
  }

  console.log('\n🎉 Seed concluído!')
  console.log('─────────────────────────────────')
  console.log('Login advogado: adv@lex.m3br.com.br')
  console.log('Senha:          Admin@2026')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
