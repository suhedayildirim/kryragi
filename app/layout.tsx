import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'GY Kariyer Ağı • Geleceği Yazanlar',description:'Teknoloji yetenekleriyle tanışın. Geleceği Yazanlar mezun ve firma buluşma platformu.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="tr"><body>{children}</body></html>}
