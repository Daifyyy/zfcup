import { createContext, useContext } from 'react'

interface TournamentContextValue {
  tournamentId: string
}

const TournamentContext = createContext<TournamentContextValue>({ tournamentId: '' })

export function TournamentProvider({ tournamentId, children }: { tournamentId: string; children: React.ReactNode }) {
  return (
    <TournamentContext.Provider value={{ tournamentId }}>
      {children}
    </TournamentContext.Provider>
  )
}

export function useTournamentId(): string {
  return useContext(TournamentContext).tournamentId
}
