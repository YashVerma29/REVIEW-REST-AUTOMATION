import { ViaSocket } from 'viasocket-apps'

export const viasocket = new ViaSocket({
  orgId: process.env.VIASOCKET_ORG_ID || '70933',
  projectId: process.env.VIASOCKET_PROJECT_ID || 'projHSG4Qlrb',
  secret: process.env.VIASOCKET_EMBED_SECRET || 'QptxmPwPJ7DeFY6NYaJ4CCWdINwvm0EUa7zDgmLKQzx'
})
