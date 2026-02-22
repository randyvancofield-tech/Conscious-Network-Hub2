declare module 'bcryptjs' {
  export interface BcryptStatic {
    hashSync(data: string, saltOrRounds: string | number): string;
    compareSync(data: string, encrypted: string): boolean;
  }

  const bcrypt: BcryptStatic;
  export default bcrypt;
}
