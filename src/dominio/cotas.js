// Cotas reais da superfície de cada camada (sem o exagero de espessura da exibição).
import { P, nat, gr, sg } from './geometria.js';

// camadas: nat (terreno), ex (pavimento existente), fre (superfície fresada), vala (reaterro), sl (subleito exposto),
// subst e reg (subleito tratado), sb (sub-base), ba e imp (base), pin e rv (revestimento), sar e mf (sarjeta e meio-fio)
export function surfAt(layer, s, z) {
  if (layer === 'nat') return nat(s, z);
  if (layer === 'fre') return gr(s) - P.EX_RV;
  if (layer === 'sl' || layer === 'subst' || layer === 'reg') return sg(s);
  if (layer === 'sb') return sg(s) + P.E_SB;
  if (layer === 'ba' || layer === 'imp') return sg(s) + P.E_SB + P.E_BA;
  return gr(s);
}
