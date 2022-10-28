import { opine, urlencoded } from 'https://deno.land/x/opine@2.3.3/mod.ts';
import sessions from '../mod.ts';

const app = opine();

app.use(urlencoded({
    extended: true
}));

sessions.init(app);

app.get('/', async (req, res) => {
    const session = await sessions.getClient(req, res);
    const name = await session.get<string>('name');

    res.send(`
    <html>
    <head>
        <title>Sessions demo</title>
    </head>
    <body>
        ${name ? `Hello, ${name}!` : ''}

        <form method=post action='/setname'>
            <label for='name-field'>Enter your name</label>
            <input type=text name=name id='name-field'>
            <input type=submit name=cmd value=Update>
            <input type=submit name=cmd value=Clear>
        </form>
    </body>
    </html>
    `);
})

app.post('/setname', async (req, res) => {
    const session = await sessions.getClient(req, res);
    if (req.body.name && req.body.cmd === 'Update') {
        await session.set('name', req.body.name);
        res.redirect('/');
    }
    if (req.body.cmd === 'Clear') {
        await session.delete('name');
        res.redirect('/');
    }
    else {
        res.setStatus(400).type('text/plain').send('Invalid request');
    }
})

app.listen(3000, () => {
    console.log('listening on port 3000')
});