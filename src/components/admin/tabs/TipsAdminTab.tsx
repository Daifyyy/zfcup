import { useTipsters } from '../../../hooks/useTipsters'
import { supabase } from '../../../lib/supabase'

interface Props {
  showToast: (msg: string) => void
}

export default function TipsAdminTab({ showToast }: Props) {
  const { tipsters } = useTipsters()

  const resetAll = async () => {
    if (!confirm('Smazat všechny tipy a vynulovat body? Tuto akci nelze vrátit.')) return
    await supabase.from('tips').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('tipsters').update({ total_points: 0 }).neq('id', '00000000-0000-0000-0000-000000000000')
    showToast('Tipy resetovány')
  }

  const deleteTipster = async (id: string, name: string) => {
    if (!confirm(`Smazat tipéra "${name}" včetně jeho tipů?`)) return
    await supabase.from('tips').delete().eq('tipster_id', id)
    await supabase.from('tipsters').delete().eq('id', id)
    showToast('Tipér smazán')
  }

  return (
    <div>
      <div className="sub-title">Tipéři ({tipsters.length})</div>

      {!tipsters.length ? (
        <p style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Zatím žádní tipéři.</p>
      ) : (
        <div className="a-list" style={{ marginBottom: '1rem' }}>
          {tipsters.map((t, i) => (
            <div key={t.id} className="a-item">
              <span style={{ fontSize: '.72rem', color: 'var(--muted)', width: 20, flexShrink: 0, textAlign: 'center' }}>{i + 1}</span>
              <span className="a-item-main" style={{ fontSize: '.85rem' }}>{t.name}</span>
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.1rem',
                color: 'var(--accent)', flexShrink: 0, marginRight: '.2rem',
              }}>{t.total_points} b.</span>
              <button type="button" className="btn btn-d btn-sm" onClick={() => deleteTipster(t.id, t.name)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <hr className="divider" />
      <div className="sub-title">Nebezpečná zóna</div>
      <p style={{ fontSize: '.76rem', color: 'var(--muted)', marginBottom: '.7rem' }}>
        Smaže všechny tipy a vynuluje body všem tipérům. Tipéři (účty) zůstanou zachovány.
      </p>
      <button type="button" className="btn btn-d" onClick={resetAll}>
        🗑 Resetovat tipy
      </button>
    </div>
  )
}
