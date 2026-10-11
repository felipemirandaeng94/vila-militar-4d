// Carrega e valida os arquivos de dados/. Os JSON entram no build pelo Vite.
import obra from '../dados/obra.json';
import servicos from '../dados/servicos.json';
import ensaios from '../dados/ensaios.json';
import decisoes from '../dados/decisoes.json';
import manual from '../dados/manual.json';
import normas from '../dados/normas.json';
import { validarDados } from './dominio/validacao.js';

export class ErroDeDados extends Error {
  constructor(erros) {
    super(`Dados inválidos (${erros.length} problema${erros.length > 1 ? 's' : ''}).`);
    this.erros = erros;
  }
}

export function carregarDados() {
  const dados = { obra, servicos, ensaios, decisoes, manual, normas };
  const erros = validarDados(dados);
  if (erros.length) throw new ErroDeDados(erros);
  return dados;
}
