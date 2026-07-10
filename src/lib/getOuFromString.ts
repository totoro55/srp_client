export default function getOuFromString(str: string):RegExpMatchArray|null {
    const regex = /OU=[^,]*/g;
    return str.match(regex)
}