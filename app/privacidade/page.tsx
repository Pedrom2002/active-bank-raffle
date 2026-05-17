import Link from 'next/link'

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-1 px-6 py-10 max-w-2xl mx-auto w-full">
        <h1 className="text-3xl font-semibold tracking-tight text-[#0A0A0A] mb-2">
          Proteção de Dados
        </h1>
        <p className="text-sm text-[#6B7280] mb-10 leading-relaxed">
          Informação sobre o tratamento de dados pessoais recolhidos no âmbito da ActivoBank Lounge, realizada durante o Mundial 2026.
        </p>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-[#0A0A0A] mb-2">1. Responsável pelo Tratamento</h2>
          <p className="text-sm text-[#374151] leading-relaxed">
            ActivoBank, S.A., com sede em Portugal. Para questões relativas ao tratamento dos seus dados pessoais, contacte-nos através dos meios disponibilizados no nosso website oficial.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-[#0A0A0A] mb-2">2. Dados Recolhidos</h2>
          <p className="text-sm text-[#374151] leading-relaxed">
            No âmbito do registo no ActivoBank Lounge, são recolhidos os seguintes dados pessoais:
          </p>
          <ul className="mt-2 text-sm text-[#374151] leading-relaxed list-disc list-inside space-y-1">
            <li>Nome completo</li>
            <li>Número de telemóvel</li>
            <li>Endereço de email</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-[#0A0A0A] mb-2">3. Finalidade do Tratamento</h2>
          <p className="text-sm text-[#374151] leading-relaxed">
            Os dados pessoais recolhidos são tratados para as seguintes finalidades:
          </p>
          <ul className="mt-2 text-sm text-[#374151] leading-relaxed list-disc list-inside space-y-1">
            <li>Gestão do acesso ao ActivoBank Lounge e registo de entrada</li>
            <li>Realização de sorteios durante os eventos e identificação dos vencedores</li>
            <li>Contacto posterior com os vencedores dos sorteios</li>
          </ul>
          <p className="mt-3 text-sm text-[#374151] leading-relaxed">
            Os dados não são utilizados para fins de marketing directo nem partilhados com terceiros para esses efeitos.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-[#0A0A0A] mb-2">4. Base Legal</h2>
          <p className="text-sm text-[#374151] leading-relaxed">
            O tratamento baseia-se no consentimento do titular, nos termos do artigo 6.º, n.º 1, alínea a) do Regulamento (UE) 2016/679 (RGPD), prestado no momento do registo.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-[#0A0A0A] mb-2">5. Prazo de Conservação</h2>
          <p className="text-sm text-[#374151] leading-relaxed">
            Os dados pessoais são conservados pelo prazo estritamente necessário à prossecução das finalidades descritas:
          </p>
          <ul className="mt-2 text-sm text-[#374151] leading-relaxed list-disc list-inside space-y-1">
            <li>Dados de registo no Lounge e de participação nos sorteios: eliminados automaticamente ao fim de 90 dias</li>
            <li>Registos de auditoria internos (sem dados pessoais identificativos): conservados por 365 dias</li>
          </ul>
          <p className="mt-3 text-sm text-[#374151] leading-relaxed">
            Findo este prazo, os dados são eliminados de forma segura e irreversível dos sistemas do responsável pelo tratamento.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-[#0A0A0A] mb-2">6. Direitos do Titular</h2>
          <p className="text-sm text-[#374151] leading-relaxed">
            O titular dos dados tem direito a, a qualquer momento, solicitar:
          </p>
          <ul className="mt-2 text-sm text-[#374151] leading-relaxed list-disc list-inside space-y-1">
            <li>Acesso aos dados pessoais que lhe dizem respeito</li>
            <li>Rectificação de dados inexactos ou incompletos</li>
            <li>Apagamento dos dados («direito a ser esquecido»)</li>
            <li>Limitação do tratamento</li>
            <li>Portabilidade dos dados</li>
            <li>Oposição ao tratamento</li>
          </ul>
          <p className="mt-3 text-sm text-[#374151] leading-relaxed">
            O titular pode ainda apresentar reclamação à autoridade de controlo competente (CNPD — Comissão Nacional de Proteção de Dados, <span className="font-medium">www.cnpd.pt</span>).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-base font-semibold text-[#0A0A0A] mb-2">7. Contacto</h2>
          <p className="text-sm text-[#374151] leading-relaxed">
            Para exercer os seus direitos ou obter esclarecimentos sobre o tratamento dos seus dados, contacte o responsável pelo tratamento através dos meios indicados no website oficial da ActivoBank.
          </p>
        </section>

        <div className="pt-4 border-t border-[#E5E7EB]">
          <Link href="/entry" className="text-sm text-[#0096DC] hover:underline">
            ← Voltar ao registo
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function Header() {
  return (
    <header className="border-b border-[#E5E7EB] px-6 py-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo_activobank.svg" alt="ActivoBank" width={137} height={22} />
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-[#E5E7EB] px-6 py-4 text-center">
      <p className="text-xs text-[#6B7280]">ActivoBank Lounge · {process.env.NEXT_PUBLIC_EVENT_LABEL ?? 'Mundial 2026'}</p>
    </footer>
  )
}
