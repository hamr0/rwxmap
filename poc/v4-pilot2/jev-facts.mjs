// D137 pilot 2: five FACTUAL Noul questions. Jev answers facts only; rule.mjs applies the rule.
// Same per-question shape as src/jev.js (type noul, instructions, criteria). No "ignore".
import fs from 'node:fs';
import crypto from 'node:crypto';

const FRAMING = 'Each row is one HTTP operation. Decide what happens when a caller who holds a normal API key for this provider calls it. Answer only what the text of the row says or makes plain.';
const INSPECT = ['description', 'summary', 'operationId', 'path', 'method'];

const q = (question, definition, focus, t, f) => ({
  type: 'noul',
  instructions: { framing: FRAMING, question, definition, inspect: INSPECT.slice(), focus },
  criteria: { true: t, false: f },
});

export function factsQuestions() {
  return {
    accessChange: q(
      'Does this call change who can do what to which resource?',
      'Access means rights: roles, permissions, policies that control access (IAM, resource, bucket, key policies), ACLs, allow lists, sharing settings, memberships of a team, org, project or group, scopes of a key or token, and who may sign up or join.',
      'Yes if the call adds, sets, replaces, edits or removes any of these. A policy that does not control access (autoscaling, lifecycle, retention, routing, rate limit) is not access.',
      'It adds, sets, replaces, edits or removes a right, role, permission, access policy, ACL, allow list, sharing setting, membership, key or token scope, or a signup or join rule.',
      'It changes nothing about who can do what: plain data, content, settings, configuration, or a non-access policy.',
    ),
    narrowOnly: q(
      'Does the text say this access change only takes access away or reduces it?',
      'Only reduces: removes a right, lowers a role, narrows a scope, shrinks an allow list, removes a member. It gives nobody anything new.',
      'Yes only when the text plainly says the change can only reduce access. If it sets, replaces or edits access without saying which way, or can add, answer no. If the call changes no access, answer no.',
      'The text plainly says the call only removes or reduces access.',
      'It adds or may add access, sets or replaces access without saying which way, or changes no access.',
    ),
    handsOver: q(
      'Does this call create or hand out something that lets someone act?',
      'Something that lets someone act: an API key, token, secret, password, signed or recovery link, session credential, a user or account that can log in, or a new member added to a team, org, project or group.',
      'Yes if the call creates, issues, returns for use, or sets any of these, or adds a member. Setting or changing a password counts. A key or token that is only computed and shown but cannot be used to act does not count.',
      'It creates, issues or sets a key, token, secret, password, signed or recovery link, session credential, login user or account, or adds a member.',
      'It hands out nothing that lets anyone act.',
    ),
    outside: q(
      'Does this call set up something that sends data or events to an outside URL or service?',
      'Outside means a URL or service that is not this API: a webhook, callback, extension, integration, forwarding rule, export target, or event subscription.',
      'Yes if the call creates or turns on such a sender, or changes where it sends. Reading or listing one is no.',
      'It creates, enables or redirects a sender of data or events to an outside URL or service.',
      'It sets up nothing that sends data or events outside.',
    ),
    otherX: q(
      'Does this call do something that a later call cannot take back?',
      'Cannot take back: deletes, removes, purges, clears or overwrites data with no trash or restore named; revokes, expires, rotates or resets a credential, key, token, secret, certificate or session; sends, delivers, notifies or publishes something to a person or the public, or exposes something publicly; moves money or commits to an outside party (charge, refund, pay, order); runs, triggers, executes, imports from outside, syncs, rebuilds or starts a job; cancels or stops something whose work or state is lost.',
      'Answer only from what the text says or makes plain. Posting a comment or reaction the same API can delete is no. Pausing or stopping something that can be started again is no. Restarting a server is no. A plain create, edit or setting change is no.',
      'The text says or makes plain one of the things that cannot be taken back.',
      'Everything it changes can be set back by a later call, or it only reads.',
    ),
  };
}

export const KEYS = ['accessChange', 'narrowOnly', 'handsOver', 'outside', 'otherX'];
export const questionJson = () => JSON.stringify(factsQuestions());

if (process.argv[1] && fs.realpathSync(process.argv[1]) === new URL(import.meta.url).pathname) {
  const out = new URL('../../data/pilot2-v4-2026-11-06/', import.meta.url).pathname;
  const s = questionJson();
  fs.writeFileSync(out + 'jev-facts-question.json', s);
  fs.writeFileSync(out + 'jev-facts-question.json.sha256', crypto.createHash('sha256').update(s).digest('hex') + '  jev-facts-question.json\n');
  console.log('chars', s.length);
}
