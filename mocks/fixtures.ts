import {Store,Artist,Terms,Proposal,transitionProposal} from '@/domain/model';
export const genres=['All sounds','Alternative R&B','Pluggnb','Trap','Rage','Rap'];

function enrich(partial: Omit<Artist,'artistTypes'|'genres'|'influences'|'featStatus'|'collaborationTypes'|'pricingMode'|'currency'> & Partial<Artist>): Artist {
  const genresList = partial.genres?.length ? partial.genres : [partial.genre.toLowerCase()];
  const collab = partial.collaborationTypes ?? (partial.trade ? ['paid','swap'] : ['paid']);
  return {
    location: '',
    influences: [],
    description: '',
    spotifyUrl: '',
    appleMusicUrl: '',
    soundcloudUrl: '',
    youtubeUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    featuredTrackUrl: '',
    featStatus: partial.trade === false ? 'selective' : 'open',
    pricingMode: 'starting_from',
    currency: 'EUR',
    onboardingComplete: true,
    ...partial,
    artistTypes: partial.artistTypes ?? ['rapper'],
    genres: genresList,
    collaborationTypes: collab,
  };
}

export const artists:Artist[]=[
enrich({id:'sora',slug:'sora',name:'Sora',genre:'Alternative R&B',language:'English',bio:'Late-night melodies. A little out of focus. Vocalist and producer building worlds between R&B and electronic music.',art:0,price:12000,days:7,trade:true,demo:true,artistTypes:['singer','producer'],genres:['r&b','melodic','experimental']}),
enrich({id:'nilo',slug:'nilo',name:'Nilo',genre:'Pluggnb',language:'English',bio:'Airy vocals, heavy feelings. Looking for people who hear the spaces between the drums.',art:1,price:8500,days:5,trade:true,demo:true,artistTypes:['rapper','songwriter'],genres:['pluggnb','melodic']}),
enrich({id:'veyra',slug:'veyra',name:'Veyra',genre:'Rage',language:'Italian',bio:'Distorted textures and restless energy. Let’s make something that feels new.',art:2,price:15000,days:10,trade:false,demo:true,artistTypes:['rapper'],genres:['rage','trap'],featStatus:'selective'}),
enrich({id:'yuno',slug:'yuno',name:'Yuno',genre:'Alternative R&B',language:'English',bio:'Soft harmonies for loud thoughts. Singer, songwriter, bedroom perfectionist.',art:3,price:9500,days:7,trade:true,demo:true,artistTypes:['singer','songwriter'],genres:['r&b','melodic']}),
enrich({id:'lowkey',slug:'lowkey',name:'lowkey',genre:'Trap',language:'French',bio:'Minimal drums. Honest verses. Independent from the first take.',art:4,price:6500,days:3,trade:true,demo:true,artistTypes:['rapper','producer'],genres:['trap','hip-hop']}),
enrich({id:'ecco',slug:'ecco',name:'ecco.wav',genre:'Pluggnb',language:'English',bio:'Digital dreams and analog feelings. Vocals, hooks and unexpected harmonies.',art:5,price:11000,days:7,trade:true,demo:true,artistTypes:['producer','engineer'],genres:['pluggnb','electronic']}),
enrich({id:'morrow',slug:'morrow',name:'Morrow',genre:'Rap',language:'Italian',bio:'Stories from the edges of the city. Every verse has somewhere to go.',art:6,price:7500,days:5,trade:true,demo:true,artistTypes:['rapper','songwriter'],genres:['hip-hop','trap']}),
enrich({id:'sol',slug:'sol',name:'Sol',genre:'Trap',language:'Spanish',bio:'Warm melodies over cold drums. Always curious about a different sound.',art:8,price:10000,days:7,trade:false,demo:true,artistTypes:['rapper'],genres:['trap','afro'],featStatus:'selective'}),
];
export const sampleTitles=['after hours','glasshouse','no signal','soft landing','outside / inside','digital bloom','concrete poetry','blue room'];
export const defaultTerms:Terms={title:'A new collaboration',brief:'A melodic verse for a late-night track.',mode:'Paid',price:8500,days:7,revisions:2,files:'Dry WAV vocals + wet reference mix',yourContribution:'A 16-bar verse',theirContribution:'A 16-bar verse',credits:'Both artists credited by artist name.',rights:'Demo evaluation only. Agree release permission and royalty shares in writing before commercial publication.',promotion:'No promotion included.'};
export function fixture():Store{const s:Store={version:1,artists:structuredClone(artists),offers:artists.flatMap(a=>[{id:`${a.id}-paid`,artist:a.id,title:'A verse in your world',mode:'Paid' as const,price:a.price,days:a.days,revisions:2,files:'Dry WAV vocals + wet reference mix',archived:false},...(a.trade?[{id:`${a.id}-trade`,artist:a.id,title:'Let’s trade verses',mode:'Trade' as const,price:0,days:7,revisions:1,files:'Dry WAV vocals + wet reference mix',archived:false}]:[])]),verses:artists.slice(0,6).map((a,i)=>({id:`verse-${i}`,owner:a.id,title:sampleTitles[i],brief:['A hazy, late-night track with room for a second voice. Looking for a melodic 16-bar verse that feels honest, understated and a little raw.','An open space between soft synths and heavy drums. Bring your own flow — let’s see where it goes.'][i%2],genre:a.genre,language:a.language,mode:i%2?'Trade':'Paid',budget:i%2?0:12000+i*1000,bpm:[132,144,156,92,140,138][i],key:['F minor','C# minor','A minor','D major','G minor','E minor'][i],art:a.art,status:'Published'})),applications:[],proposals:[],collaborations:[],messages:[],blocked:[],reports:[],reviews:[]};
 const p:Proposal={id:'proposal-seed',from:'sora',to:'nilo',payer:'sora',performer:'nilo',terms:{...defaultTerms,title:'Blue hour — verse exchange',mode:'Trade',price:0,tradeDate:new Date(Date.now()+7*86400000).toISOString()},status:'Sent',created:new Date().toISOString(),expires:new Date(Date.now()+7*86400000).toISOString()};s.proposals.push(p);transitionProposal(s,p.id,'nilo','Accepted');s.collaborations[0].id='blue-hour';
 const q:Proposal={...p,id:'proposal-paid',terms:{...defaultTerms,title:'After hours — vocal feature'},status:'Sent'};s.proposals.push(q);transitionProposal(s,q.id,'nilo','Accepted');s.collaborations[1].id='after-hours';
 s.messages.push({id:'welcome',proposal:p.id,author:'nilo',text:'Love the space in this beat. I’m thinking a softer delivery on the second verse. Let’s build on it.',at:new Date().toISOString()});return s;}
