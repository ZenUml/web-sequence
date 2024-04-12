There are a few ways to inject into the iFrame.

# Why we want to continue with iFrame?

The main reason is to isolate CSS.

# Inject as a `<link>`

To get a url that hosts vue-sequence.css, we could you unpkg.com. This is fairly reliable. The main issue however is we have to manually update the version when we update vue-sequence.

Another way is to host it locally. The challenge is then how to get it hosted. We could use a script to copy vue-sequence.css to the lib folder.

# Inject styles into iFrame

When we call `import vueSeqStyles 'vue-sequence/dist/vue-sequence.css'` it import that as
