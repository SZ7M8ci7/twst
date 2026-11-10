"""Snapshot video observations, never simulator predictions, for the exam19 audit.

Run from the repository root. Original video audit files live in output/.
The generated fixture is self-contained; rerunning tests does not need output/.
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sources = {}
datasets = []


def read(name):
    path = ROOT / 'output' / name
    raw = path.read_bytes()
    sources[name] = hashlib.sha256(raw).hexdigest()
    return json.loads(raw.decode('utf-8-sig'))


def dataset(name, preset, source, challenges=()):
    result = dict(name=name, preset=preset, source=source,
                  challenges=list(challenges), enemy=[], player=[], excluded=[])
    datasets.append(result)
    return result


def common(g):
    return dict(battle=g.get('global_battle', g.get('battle')), turn=g.get('turn'),
                order=g.get('order'), video=g.get('video'),
                time=g.get('time', g.get('t', g.get('times', [None])[0])),
                values=g['values'])


for folder, preset, challenge in [
    ('exam19_fire', '火BS', []),
    ('exam19_fire_challenge', '火BS', ['enemyDamageUp:5']),
    ('exam19_taken_damage', '火BS', ['playerDamageTakenUp:3']),
    ('exam19_atk_challenge', '火BS', ['enemyAttackUp:3']),
    ('exam19_water', '水BS', []),
]:
    src = folder + '/audit_actions.json'
    d = dataset(folder, preset, src, challenge)
    for g in read(src):
        if g['debuff']:
            d['excluded'].append(dict(**common(g), reason='ATK DOWN magnitude not recorded'))
            continue
        d['enemy'].append(dict(**common(g), actor=g['char'], attack=g['attack'],
                              affinity=g['affinity'], own=g['atk'], damage=g['dmg']))
    if folder == 'exam19_water':
        # Spell inputs recorded in fit_player.py / supplied formation images.
        magic = {'U2': (6407, 0, '強2連', '水', 10), 'U3': (6407, 0, '弱3連', '水', 10),
                 'M1': (4852, .2, '強単発', '水', 10), 'M2': (4852, .2, '強2連', '無', 10),
                 'MD': (4852, .2, '強2連', '無', 10), 'T1': (4803, 0, '強単発', '水', 10),
                 'T3': (4803, 0, '弱2連', '無', 5)}
        for g in read(folder + '/player_verified_actions.json'):
            if g['excluded']:
                d['excluded'].append(dict(**common(g), reason='Azul cards have different stats; excluded in original audit'))
                continue
            code = g['code']
            key = code[:-1] if code != 'MD' and code[-1] in 'DS' else code
            atk, buddy, attack, element, level = magic[key]
            d['player'].append(dict(**common(g), actor=code, atk=atk, buddy=buddy,
                                   attack=attack, element=element, level=level, affinity=1,
                                   damageBuff=.0875 if key.startswith('M') else 0, duo=key=='MD',
                                   atkDownCount=int(g['condition']=='ATK DOWN'),
                                   reductionCount=int(g['condition']=='被ダメージDOWN')))

for folder, challenge in [('exam19_water_challenges', ['playerDamageTakenUp:3']),
                          ('exam19_water_challenges_atk', ['enemyAttackUp:2'])]:
    src = folder + '/enemy_annotated.json'
    d = dataset(folder, '水BS', src, challenge + ['playerDamageDown:2'])
    for g in read(src):
        d['enemy'].append(dict(**common(g), actor={'L': 'レオナ', 'R': 'ラギー', 'J': 'ジャック'}[g['actor']],
                              attack={'W': '弱2連', 'S': '強2連', 'Q': '強単発'}[g['power']],
                              affinity=g['affinity'], own=g['atk_up'], damage=g['damage_up'],
                              defenderDorm='サバナクロー' if g['target'] == 'L' else 'その他'))
    party = read(folder + '/conditions.json')['player']
    for g in read(folder + '/fit_input.json')['wood']:
        # Source scale includes the recorded ATK DOWN. Recover the input ATK
        # from the documented formation, not from observed damage.
        d['player'].append(dict(battle=None, turn=1, time=g['t'], values=[g['value']],
                               actor=g['actor'], atk=party[g['actor']]['atk'],
                               attack='強2連', element='木', level=10, affinity=1.5,
                               atkDownCount=g['down'], reductionCount=int(g['shield']>0)))

for folder, challenges in [
    ('exam19_wood_df', []),
    ('exam19_wood_df_extra', ['playerDamageTakenUp:3', 'playerDamageDown:2']),
    ('exam19_wood_df_taken_down', ['enemyDamageReduction:2']),
]:
    src = folder + '/enemy_actions.json'
    d = dataset(folder, '木DF', src, challenges)
    for g in read(src):
        d['enemy'].append(dict(**common(g), actor=g['character'], attack=g['attack'],
                              affinity=g['affinity'], single=g['atk_up_single_count'],
                              own=g['atk_up_double_count'], damage=g['damage_up_count'],
                              defenderDorm='イグニハイド' if g.get('defender') == 'オルト' else 'その他'))
    for g in read(folder + '/player_actions.json'):
        if not g['values']:
            d['excluded'].append(dict(**common(g), reason='blind MISS (tested separately per spell)'))
            continue
        attack = g.get('attack') or ('強単発' if g['hits'] == 1 else '弱2連' if g['magic'] == 'L2' else '強2連')
        d['player'].append(dict(**common(g), actor=g['character'], atk=g['atk'],
                               buddy=g['buddy_atk_up'], own=g['self_atk_up'],
                               attack=attack, element=g['element'], level=g['magic_level'],
                               affinity=g['affinity'], duo=g['hits'] == 3))

for folder, challenges in [
    ('exam19_neutral_df', []),
    ('exam19_neutral_df_challenges', ['enemyDamageUp:5', 'playerDamageDown:2:水']),
    ('exam19_neutral_df_challenges_3t', ['enemyDamageUp:3', 'playerDamageDown:2:水']),
]:
    src = folder + '/all_actions.json'
    d = dataset(folder, '無DF', src, challenges)
    for g in read(src):
        buffs = g['buffs']
        if g['side'] == 'enemy':
            d['enemy'].append(dict(**common(g), actor=g['actor'], attack=g['attack'], affinity=1,
                                  own=buffs.count('ATKUP1') + buffs.count('自己ATKUP'),
                                  shared=buffs.count('ATKUP2'),
                                  damage=buffs.count('ダメUP1') + buffs.count('自己ダメUP')))
        else:
            d['player'].append(dict(**common(g), actor=g['actor'], atk=g['base_atk'],
                                   own=g.get('atk_multiplier', 1)-1 if 'atk_multiplier' in g else .2*len(buffs),
                                   attack=g['attack'], element=g['attribute'], level=g.get('magic_level') or (5 if g['code']=='L2' else 10),
                                   affinity=1, duo=g.get('duo', False)))

for folder, challenges in [
    ('', []), ('challenge_atk10_blind2', ['enemyAttackUp:10']),
    ('challenge_taken5_blind2_enemy_down2', ['playerDamageTakenUp:5', 'enemyDamageReduction:2']),
    ('challenge_atk2_blind2', ['enemyAttackUp:2']),
]:
    folder = 'exam19_all_atk' + ('/' + folder if folder else '')
    src = folder + '/enemy_actions_annotated.json'
    d = dataset(folder, '全ATK', src, challenges)
    for g in read(src):
        d['enemy'].append(dict(**common(g), actor=g['actor'], attack=g['attack'],
                              affinity=g['matchup_multiplier'], own=g['self_atk_count'],
                              shared=g['shared_atk_count'], damage=g['damage_icons']))
    groups = read(folder + '/player_actions_annotated.json')
    for g in groups:
        who = g['actor_code']
        if who == 'T':
            d['excluded'].append(dict(**common(g), reason='own/support Trey not distinguished in source'))
            continue
        own = who == 'L' and any(x['magic'] == 'L1' and (x['battle'], x['turn']) == (g['battle'], g['turn']) for x in groups)
        d['player'].append(dict(**common(g), actor=g['actor'], atk={'M': 4852, 'O': 5591, 'L': 4579}[who],
                               buddy=.2 if who == 'M' else 0, own=.2 if own else 0,
                               damageBuff=.0875 if who == 'M' else 0,
                               attack=g['attack'], element=g['element'], level=g['magic_level'],
                               affinity=g['matchup_multiplier'], duo=len(g['values']) == 3))

d = dataset('exam19_damage_down', '火BS', 'exam19_damage_down/audit_actions.json', ['playerDamageDown:2'])
for g in read(d['source']):
    d['player'].append(dict(**common(g), actor=g['code'], atk=g['atk'], own=g['atk_rate']-1,
                           attack=('弱' if g['power']==.75 else '強') + ('単発' if g['hit_count']==1 else '2連'),
                           element='無' if g['power']==1.1 else '水' if g['affinity']==1.5 else '火', level=10,
                           affinity=g['affinity'], duo=g['hit_count']==3))

burn = read('exam19_water_challenges/measurement_result.json')['burn_events']
wood_burn = read('exam19_wood_df/burn_events.json')
fixture = dict(format=1, sources=sources, datasets=datasets,
               burnWater=burn, burnWood=wood_burn,
               evasion=read('exam19_evasion/evasion_audit.json'))
out = ROOT / 'scripts/tests/fixtures/exam19-observations.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(fixture, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'{out}: {len(datasets)} datasets, {sum(sum(len(g["values"]) for g in d["enemy"]) for d in datasets)} enemy hits')
